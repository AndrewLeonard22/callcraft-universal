import { useCallback, useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Ruler, Eye, Layers, ExternalLink, Loader2, X, Box } from "lucide-react";

/**
 * BadassMapCanvas — the interactive Google Maps setter surface (Andrew's ask:
 * "type an address → see the house, the distance, the route, measure the backyard,
 * all in one place, don't jump software to software").
 *
 * Replaces the keyless iframe GoogleCanvas with the Google Maps JS API:
 *   • Places (New) autocomplete address search
 *   • Hybrid satellite + 45° oblique tilt (the "3D-ish" aerial; real 3D/Map3DElement
 *     is beta-channel-only today, deferred to v2)
 *   • Street View of the home
 *   • Driving route from HQ (red polyline) + distance/drive-time
 *   • Draw-to-measure the yard → live sq-ft readout (turf/pool sizing)
 *
 * GRACEFUL: with no VITE_GOOGLE_MAPS_API_KEY it renders the keyless iframe fallback,
 * so it never hard-breaks. Lazy: the JS API only loads when this canvas mounts.
 */

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
// A vector Map ID unlocks tilt + AdvancedMarkerElement (raster 45° imagery is
// deprecated). DEMO_MAP_ID works out of the box; set VITE_GOOGLE_MAPS_MAP_ID to a
// real Cloud-console vector Map ID for prod.
const MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || "DEMO_MAP_ID";
const SQM_TO_SQFT = 10.7639104;

export interface BadassMapCanvasProps {
  searchedQuery?: string | null;
  hqAddress?: string;
  hqLat?: number | null;
  hqLng?: number | null;
  serviceRadiusMiles?: number;
}

// One Loader per page — constructing twice with different options throws.
// `importLibrary` exists at runtime (verified headless) but @types/google.maps
// lags on the Loader instance, so we widen the return type to declare it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches google.maps.importLibrary's own Promise<any> signature
type LoaderWithImport = Loader & { importLibrary: (name: string) => Promise<any> };

// @types/google.maps.drawing's DrawingManager is incomplete (omits setMap/setDrawingMode
// and types the constructor as 0-arg) though all exist at runtime — a minimal shim
// covers the methods we actually call.
interface DrawMgr {
  setMap(map: google.maps.Map | null): void;
  setDrawingMode(mode: unknown): void;
  addListener(event: string, cb: (...args: unknown[]) => void): google.maps.MapsEventListener;
}
// Map3DElement (photorealistic 3D / "Google Earth" view) — verified available on the
// weekly channel (headless), but @types/google.maps doesn't type it yet. Minimal shim.
interface Map3D extends HTMLElement {
  center: { lat: number; lng: number; altitude: number };
}
let loaderSingleton: LoaderWithImport | null = null;
function getLoader(): LoaderWithImport {
  if (!loaderSingleton) {
    loaderSingleton = new Loader({ apiKey: API_KEY as string, version: "weekly" }) as LoaderWithImport;
  }
  return loaderSingleton;
}

function focusQuery({ searchedQuery, hqAddress, hqLat, hqLng }: BadassMapCanvasProps): string | null {
  return (
    searchedQuery?.trim() ||
    hqAddress?.trim() ||
    (hqLat != null && hqLng != null ? `${hqLat},${hqLng}` : null)
  );
}

function NoLocation() {
  return (
    <div className="h-full flex items-center justify-center text-center px-8">
      <div>
        <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <div className="text-[13px] font-medium text-foreground">No location to show yet</div>
        <div className="text-[12px] text-muted-foreground mt-1">
          Check an address in the rail, or set the HQ address in Edit Client → Service Area
        </div>
      </div>
    </div>
  );
}

// Keyless iframe — the fallback when no key is configured or the JS API fails to load.
function IframeFallback(props: BadassMapCanvasProps) {
  const q = focusQuery(props);
  if (!q) return <NoLocation />;
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=k&z=18&output=embed`;
  return (
    <iframe
      key={src}
      src={src}
      title="Satellite view"
      className="h-full w-full border-0"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

export function BadassMapCanvas(props: BadassMapCanvasProps) {
  if (!API_KEY) return <IframeFallback {...props} />;
  return <InteractiveMap {...props} />;
}

function InteractiveMap({ searchedQuery, hqAddress, hqLat, hqLng, serviceRadiusMiles }: BadassMapCanvasProps) {
  // In-range verdict for the focused address (the ZipChecker's one irreplaceable job, now native)
  const [verdict, setVerdict] = useState<{ miles: number; inRange: boolean } | null>(null);
  // Est. home value (RentCast via /api/home-value — qualification gold next to a $25k minimum)
  const [homeValue, setHomeValue] = useState<{ value: number; low: number | null; high: number | null } | null>(null);
  const mapDiv = useRef<HTMLDivElement>(null);
  const svDiv = useRef<HTMLDivElement>(null);
  const acHost = useRef<HTMLDivElement>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const dirServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const dirRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const drawingRef = useRef<DrawMgr | null>(null);
  const measurePolyRef = useRef<google.maps.Polygon | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const advMarkerCtor = useRef<typeof google.maps.marker.AdvancedMarkerElement | null>(null);
  const map3dHost = useRef<HTMLDivElement>(null);
  const map3dRef = useRef<Map3D | null>(null);
  // Monotonic focus token: the LATEST-initiated focus wins, whichever resolves last.
  // Shared by both focus sources (rail geocode + in-map autocomplete) so intent order holds.
  const focusReqRef = useRef(0);
  // Coords of the current focus, so an HQ change can re-route from the new origin.
  const lastFocusRef = useRef<google.maps.LatLngLiteral | null>(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [mapType, setMapType] = useState<"hybrid" | "roadmap">("hybrid");
  const [streetOpen, setStreetOpen] = useState(false);
  const [streetReady, setStreetReady] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [areaSqFt, setAreaSqFt] = useState<number | null>(null);
  const [route, setRoute] = useState<{ miles: number; mins: number } | null>(null);
  // Starts null (not the raw query) so the pill only ever shows the resolved address.
  const [focusLabel, setFocusLabel] = useState<string | null>(null);
  const [view3d, setView3d] = useState(false);
  const [threeDReady, setThreeDReady] = useState(true); // flips false only if maps3d fails to load

  const hasHq = hqLat != null && hqLng != null;

  // Wipe the rendered route + its readout (used before every new focus + on route failure).
  const clearRoute = useCallback(() => {
    dirRendererRef.current?.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult);
    setRoute(null);
  }, []);

  // Exit measure mode entirely — the polygon + sq-ft belong to the previous property.
  const exitMeasure = useCallback(() => {
    drawingRef.current?.setMap(null);
    drawingRef.current = null;
    measurePolyRef.current?.setMap(null);
    measurePolyRef.current = null;
    setMeasuring(false);
    setAreaSqFt(null);
  }, []);

  const drawRoute = useCallback(
    async (origin: google.maps.LatLngLiteral, dest: google.maps.LatLngLiteral) => {
      const map = mapRef.current;
      if (!map) return;
      const { DirectionsService, DirectionsRenderer } = (await getLoader().importLibrary(
        "routes",
      )) as google.maps.RoutesLibrary;
      if (!mapRef.current) return; // unmounted during the await
      if (!dirServiceRef.current) dirServiceRef.current = new DirectionsService();
      if (!dirRendererRef.current) {
        dirRendererRef.current = new DirectionsRenderer({
          map,
          suppressMarkers: false,
          // Andrew's "that red route".
          polylineOptions: { strokeColor: "#ef4444", strokeWeight: 5, strokeOpacity: 0.9 },
        });
      }
      try {
        const res = await dirServiceRef.current.route({
          origin,
          destination: dest,
          travelMode: google.maps.TravelMode.DRIVING,
        });
        dirRendererRef.current.setDirections(res);
        const leg = res.routes[0]?.legs[0];
        if (leg?.distance && leg?.duration) {
          setRoute({ miles: leg.distance.value / 1609.34, mins: leg.duration.value / 60 });
        }
      } catch {
        // Route couldn't be computed — clear it so no stale route lingers on the new house.
        clearRoute();
      }
    },
    [clearRoute],
  );

  // Center on a resolved location: clear stale route/measurement, drop a marker, seed
  // street view, and (if HQ is known) draw the route. Callers pass their focus token so
  // an out-of-order async resolution can bail before touching the map.
  const focusOn = useCallback(
    (lat: number, lng: number, label: string | null, reqId: number) => {
      if (reqId !== focusReqRef.current) return; // a newer focus superseded this one
      const map = mapRef.current;
      if (!map) return;

      clearRoute();
      if (measuring) exitMeasure();

      map.setCenter({ lat, lng });
      map.setZoom(19);
      setFocusLabel(label);
      lastFocusRef.current = { lat, lng };
      if (hqLat != null && hqLng != null) {
        const R = 3958.8;
        const dLat = ((lat - hqLat) * Math.PI) / 180;
        const dLng = ((lng - hqLng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((hqLat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const miles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        setVerdict({ miles, inRange: serviceRadiusMiles ? miles <= serviceRadiusMiles : true });
      }
      setHomeValue(null);
      if (label) {
        fetch(`/api/home-value?address=${encodeURIComponent(label)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (reqId !== focusReqRef.current) return; // stale focus
            if (d && typeof d.value === "number") setHomeValue({ value: d.value, low: d.low, high: d.high });
          })
          .catch(() => {});
      }
      // Keep the 3D view (if it exists) tracking the same address.
      if (map3dRef.current) map3dRef.current.center = { lat, lng, altitude: 0 };

      panoRef.current?.setPosition({ lat, lng });
      setStreetReady(true);

      if (advMarkerCtor.current) {
        if (markerRef.current) markerRef.current.map = null;
        markerRef.current = new advMarkerCtor.current({ map, position: { lat, lng } });
      }

      if (hasHq) void drawRoute({ lat: hqLat as number, lng: hqLng as number }, { lat, lng });
    },
    [clearRoute, measuring, exitMeasure, hasHq, hqLat, hqLng, drawRoute],
  );

  // 1) Load the API + build the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loader = getLoader();
        const [{ Map }, { StreetViewPanorama }, { AdvancedMarkerElement }] = await Promise.all([
          loader.importLibrary("maps"),
          loader.importLibrary("streetView"),
          loader.importLibrary("marker"),
        ]);
        if (cancelled || !mapDiv.current) return;
        advMarkerCtor.current = AdvancedMarkerElement;

        const center = hasHq
          ? { lat: hqLat as number, lng: hqLng as number }
          : { lat: 39.5, lng: -98.35 };
        const map = new Map(mapDiv.current, {
          center,
          zoom: hasHq ? 12 : 4,
          mapId: MAP_ID,
          mapTypeId: "hybrid",
          tilt: 45,
          heading: 0,
          gestureHandling: "greedy",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          rotateControl: true,
        });
        mapRef.current = map;

        // The qualifier's anchor: HQ pin + the service-radius ring so setters
        // SEE the boundary, not just read a verdict.
        if (hasHq) {
          new google.maps.Circle({
            map,
            center,
            radius: (serviceRadiusMiles || 30) * 1609.34,
            strokeColor: "#22C55E",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#22C55E",
            fillOpacity: 0.05,
            clickable: false,
          });
          new AdvancedMarkerElement({ map, position: center, title: "HQ" });
        }

        if (svDiv.current) {
          const pano = new StreetViewPanorama(svDiv.current, {
            visible: false,
            enableCloseButton: false,
            addressControl: false,
          });
          panoRef.current = pano;
          map.setStreetView(pano);
          // Seed the pano at HQ so "Street" works before any search (else it opens blank).
          if (hasHq) {
            pano.setPosition({ lat: hqLat as number, lng: hqLng as number });
            setStreetReady(true);
          }
        }
        setReady(true);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
      // Real teardown — Google Maps + WebGL contexts don't get GC'd on their own, so a
      // repeatedly opened/closed tab would leak contexts until the map breaks.
      dirRendererRef.current?.setMap(null);
      dirRendererRef.current = null;
      drawingRef.current?.setMap(null);
      drawingRef.current = null;
      measurePolyRef.current?.setMap(null);
      measurePolyRef.current = null;
      if (markerRef.current) markerRef.current.map = null;
      markerRef.current = null;
      if (mapRef.current) google.maps.event.clearInstanceListeners(mapRef.current);
      if (panoRef.current) google.maps.event.clearInstanceListeners(panoRef.current);
      mapRef.current = null;
      panoRef.current = null;
      map3dRef.current?.remove();
      map3dRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Mount the Places (New) autocomplete once the map is ready.
  useEffect(() => {
    if (!ready || !acHost.current) return;
    let el: HTMLElement | null = null;
    let cancelled = false;
    (async () => {
      const { PlaceAutocompleteElement } = (await getLoader().importLibrary(
        "places",
      )) as google.maps.PlacesLibrary;
      if (cancelled || !acHost.current) return;
      el = new PlaceAutocompleteElement({ includedRegionCodes: ["us"] }) as unknown as HTMLElement;
      el.style.width = "100%";
      acHost.current.appendChild(el);
      el.addEventListener("gmp-select", async (e: unknown) => {
        // Claim the latest focus token BEFORE the await so the last pick wins the race.
        const myReq = ++focusReqRef.current;
        const prediction = (e as { placePrediction?: { toPlace: () => google.maps.places.Place } })
          .placePrediction;
        if (!prediction) return;
        const place = prediction.toPlace();
        await place.fetchFields({ fields: ["formattedAddress", "location"] });
        const loc = place.location;
        if (loc) focusOn(loc.lat(), loc.lng(), place.formattedAddress ?? null, myReq);
      });
    })();
    return () => {
      cancelled = true;
      el?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // 3) React to the rail's checked address → geocode + focus (+ route).
  useEffect(() => {
    if (!ready || !searchedQuery?.trim()) return;
    let cancelled = false;
    const myReq = ++focusReqRef.current;
    (async () => {
      const { Geocoder } = (await getLoader().importLibrary(
        "geocoding",
      )) as google.maps.GeocodingLibrary;
      const geo = new Geocoder();
      try {
        const { results } = await geo.geocode({ address: searchedQuery });
        if (cancelled || !results?.[0]) return;
        const loc = results[0].geometry.location;
        focusOn(loc.lat(), loc.lng(), results[0].formatted_address, myReq);
      } catch {
        /* geocode miss — leave the map where it is */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, searchedQuery]);

  // 4) HQ changed after mount (e.g. a realtime client update) → recenter / re-route so
  //    the "mi from HQ" figure never goes stale.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map || !hasHq) return;
    if (lastFocusRef.current) {
      void drawRoute({ lat: hqLat as number, lng: hqLng as number }, lastFocusRef.current);
    } else {
      map.setCenter({ lat: hqLat as number, lng: hqLng as number });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, hqLat, hqLng]);

  // Map type toggle (hybrid satellite ↔ road).
  useEffect(() => {
    mapRef.current?.setMapTypeId(mapType);
  }, [mapType]);

  const toggleStreet = () => {
    const p = panoRef.current;
    if (!p || !streetReady) return;
    const next = !streetOpen;
    p.setVisible(next);
    setStreetOpen(next);
  };

  const toggleMeasure = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    if (measuring) {
      exitMeasure();
      return;
    }
    const [{ DrawingManager, OverlayType }, { spherical }] = await Promise.all([
      getLoader().importLibrary("drawing") as Promise<google.maps.DrawingLibrary>,
      getLoader().importLibrary("geometry") as Promise<google.maps.GeometryLibrary>,
    ]);
    if (!mapRef.current) return; // unmounted during the await
    const dm = new (DrawingManager as unknown as new (opts: unknown) => DrawMgr)({
      drawingMode: OverlayType.POLYGON,
      drawingControl: false,
      polygonOptions: {
        fillColor: "#22c55e",
        fillOpacity: 0.22,
        strokeColor: "#16a34a",
        strokeWeight: 2,
        editable: true,
      },
    });
    dm.setMap(map);
    drawingRef.current = dm;
    setMeasuring(true);
    dm.addListener("polygoncomplete", (poly: google.maps.Polygon) => {
      measurePolyRef.current?.setMap(null);
      measurePolyRef.current = poly;
      dm.setDrawingMode(null);
      const recompute = () =>
        setAreaSqFt(spherical.computeArea(poly.getPath()) * SQM_TO_SQFT);
      recompute();
      const path = poly.getPath();
      path.addListener("set_at", recompute);
      path.addListener("insert_at", recompute);
      path.addListener("remove_at", recompute);
    });
  }, [measuring, exitMeasure]);

  // Photorealistic 3D ("Google Earth") — toggles a Map3DElement over the 2D map,
  // centered on the current focus. Graceful: if maps3d can't load, the button hides.
  const toggle3d = useCallback(async () => {
    if (view3d) {
      setView3d(false);
      return;
    }
    const host = map3dHost.current;
    const focus =
      lastFocusRef.current ?? (hasHq ? { lat: hqLat as number, lng: hqLng as number } : null);
    if (!host || !focus) return;
    try {
      if (!map3dRef.current) {
        const { Map3DElement } = await getLoader().importLibrary("maps3d");
        const el = new Map3DElement({
          center: { lat: focus.lat, lng: focus.lng, altitude: 0 },
          range: 450,
          tilt: 62,
        }) as unknown as Map3D;
        el.style.width = "100%";
        el.style.height = "100%";
        host.appendChild(el);
        map3dRef.current = el;
      } else {
        map3dRef.current.center = { lat: focus.lat, lng: focus.lng, altitude: 0 };
      }
      setView3d(true);
    } catch {
      setThreeDReady(false); // maps3d unavailable — hide the 3D button
    }
  }, [view3d, hasHq, hqLat, hqLng]);

  if (loadError) {
    return (
      <IframeFallback
        searchedQuery={searchedQuery}
        hqAddress={hqAddress}
        hqLat={hqLat}
        hqLng={hqLng}
      />
    );
  }

  const btn = "h-7 px-2.5 text-[11px] shadow-md gap-1";

  return (
    <div className="relative h-full w-full">
      <div ref={mapDiv} className="h-full w-full" />
      <div ref={svDiv} className={`absolute inset-0 ${streetOpen ? "" : "hidden"}`} />
      <div ref={map3dHost} className={`absolute inset-0 ${view3d ? "" : "hidden"}`} />

      {!ready && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-muted/30">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Address search (Places autocomplete) + in-range verdict */}
      <div className="absolute top-3 left-3 z-10 w-80 max-w-[75%] space-y-1.5">
        <div
          ref={acHost}
          className="rounded-lg bg-background/95 shadow-md border border-border [&_gmp-place-autocomplete]:w-full"
        />

      </div>

      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-wrap justify-end gap-1.5">
        <Button
          size="sm"
          variant={mapType === "hybrid" ? "default" : "outline"}
          className={btn}
          onClick={() => setMapType(mapType === "hybrid" ? "roadmap" : "hybrid")}
        >
          <Layers className="h-3.5 w-3.5" />
          {mapType === "hybrid" ? "Satellite" : "Road"}
        </Button>
        <Button
          size="sm"
          variant={streetOpen ? "default" : "outline"}
          className={btn}
          onClick={toggleStreet}
          disabled={!streetReady}
        >
          {streetOpen ? <X className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          Street
        </Button>
        <Button size="sm" variant={measuring ? "default" : "outline"} className={btn} onClick={toggleMeasure}>
          <Ruler className="h-3.5 w-3.5" />
          Measure
        </Button>
        {threeDReady && (
          <Button size="sm" variant={view3d ? "default" : "outline"} className={btn} onClick={toggle3d}>
            <Box className="h-3.5 w-3.5" />
            3D
          </Button>
        )}
        {focusLabel && (
          <Button
            size="sm"
            variant="outline"
            className={btn}
            onClick={() =>
              window.open(
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(focusLabel)}`,
                "_blank",
                "noopener",
              )
            }
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </Button>
        )}
      </div>

      {/* Bottom overlays — stacked in one column so they never collide on a narrow pane. */}
      {!streetOpen && (focusLabel || route || measuring) && (
        <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 max-w-[75%]">
          {focusLabel && (
            <div
              className={`space-y-1 rounded-xl border px-3.5 py-2.5 text-[12px] font-medium shadow-lg backdrop-blur ${
                verdict
                  ? verdict.inRange
                    ? "border-green-300 bg-green-50/95"
                    : "border-red-300 bg-red-50/95"
                  : "border-border bg-background/95"
              }`}
            >
              <div className="truncate text-[12.5px] font-semibold text-foreground">📍 {focusLabel}</div>
              {verdict && (
                <div className={`text-[13px] font-bold ${verdict.inRange ? "text-green-700" : "text-red-700"}`}>
                  {verdict.inRange ? "✓ IN SERVICE AREA" : "✗ OUTSIDE SERVICE AREA"}
                  <span className="font-medium text-muted-foreground">
                    {" "}· {verdict.miles < 1 ? "<1" : Math.round(verdict.miles)} mi
                    {serviceRadiusMiles ? ` of ${serviceRadiusMiles}` : ""}
                  </span>
                </div>
              )}
              {route && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Navigation className="h-3.5 w-3.5 shrink-0 text-red-500" />
                  {route.miles.toFixed(1)} mi drive · {Math.round(route.mins)} min
                </div>
              )}
              {homeValue && (
                <div className="text-foreground">
                  🏠 Est. value ~${Math.round(homeValue.value / 1000)}K
                  {homeValue.low && homeValue.high && (
                    <span className="text-muted-foreground"> (${Math.round(homeValue.low / 1000)}K–${Math.round(homeValue.high / 1000)}K)</span>
                  )}
                </div>
              )}
            </div>
          )}
          {measuring && (
            <div className="bg-background/95 border border-border rounded-lg px-3 py-1.5 text-[11px] font-medium shadow-md">
              {areaSqFt != null ? (
                <>📐 {Math.round(areaSqFt).toLocaleString()} sq ft</>
              ) : (
                <>Draw a shape on the yard to measure it</>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
