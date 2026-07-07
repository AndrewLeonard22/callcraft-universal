import { useCallback, useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Ruler, Eye, Layers, ExternalLink, Loader2, X } from "lucide-react";

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
}

// One Loader per page — constructing twice with different options throws.
let loaderSingleton: Loader | null = null;
function getLoader(): Loader {
  if (!loaderSingleton) {
    loaderSingleton = new Loader({ apiKey: API_KEY as string, version: "weekly" });
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

function InteractiveMap({ searchedQuery, hqAddress, hqLat, hqLng }: BadassMapCanvasProps) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const svDiv = useRef<HTMLDivElement>(null);
  const acHost = useRef<HTMLDivElement>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const dirServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const dirRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  // Loosely typed — drawing/marker classes come from importLibrary at runtime.
  const drawingRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const measurePolyRef = useRef<google.maps.Polygon | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const sphericalRef = useRef<typeof google.maps.geometry.spherical | null>(null);
  const advMarkerCtor = useRef<typeof google.maps.marker.AdvancedMarkerElement | null>(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [mapType, setMapType] = useState<"hybrid" | "roadmap">("hybrid");
  const [streetOpen, setStreetOpen] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [areaSqFt, setAreaSqFt] = useState<number | null>(null);
  const [route, setRoute] = useState<{ miles: number; mins: number } | null>(null);
  const [focusLabel, setFocusLabel] = useState<string | null>(searchedQuery ?? null);

  const hasHq = hqLat != null && hqLng != null;

  // Center the map, drop a marker, wire street view, and (if HQ is known) draw the route.
  const focusOn = useCallback(
    (lat: number, lng: number, label: string | null) => {
      const map = mapRef.current;
      if (!map) return;
      map.setCenter({ lat, lng });
      map.setZoom(19);
      setFocusLabel(label);
      panoRef.current?.setPosition({ lat, lng });

      if (advMarkerCtor.current) {
        if (markerRef.current) markerRef.current.map = null;
        markerRef.current = new advMarkerCtor.current({ map, position: { lat, lng } });
      }

      if (hasHq) void drawRoute({ lat: hqLat as number, lng: hqLng as number }, { lat, lng });
    },
    // drawRoute is stable (defined below with empty deps); hq* are primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasHq, hqLat, hqLng],
  );

  const drawRoute = useCallback(
    async (origin: google.maps.LatLngLiteral, dest: google.maps.LatLngLiteral) => {
      const map = mapRef.current;
      if (!map) return;
      const { DirectionsService, DirectionsRenderer } = (await getLoader().importLibrary(
        "routes",
      )) as google.maps.RoutesLibrary;
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
        setRoute(null);
      }
    },
    [],
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

        if (svDiv.current) {
          const pano = new StreetViewPanorama(svDiv.current, {
            visible: false,
            enableCloseButton: false,
            addressControl: false,
          });
          panoRef.current = pano;
          map.setStreetView(pano);
        }
        setReady(true);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
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
        // The event payload carries a placePrediction; resolve it to a Place and fetch fields.
        const prediction = (e as { placePrediction?: { toPlace: () => google.maps.places.Place } })
          .placePrediction;
        if (!prediction) return;
        const place = prediction.toPlace();
        await place.fetchFields({ fields: ["formattedAddress", "location"] });
        const loc = place.location;
        if (loc) focusOn(loc.lat(), loc.lng(), place.formattedAddress ?? null);
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
    (async () => {
      const { Geocoder } = (await getLoader().importLibrary(
        "geocoding",
      )) as google.maps.GeocodingLibrary;
      const geo = new Geocoder();
      try {
        const { results } = await geo.geocode({ address: searchedQuery });
        if (cancelled || !results?.[0]) return;
        const loc = results[0].geometry.location;
        focusOn(loc.lat(), loc.lng(), results[0].formatted_address);
      } catch {
        /* geocode miss — leave the map where it is */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, searchedQuery]);

  // Map type toggle (hybrid satellite ↔ road).
  useEffect(() => {
    mapRef.current?.setMapTypeId(mapType);
  }, [mapType]);

  const toggleStreet = () => {
    const p = panoRef.current;
    if (!p) return;
    const next = !streetOpen;
    p.setVisible(next);
    setStreetOpen(next);
  };

  const toggleMeasure = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    if (measuring) {
      drawingRef.current?.setMap(null);
      drawingRef.current = null;
      measurePolyRef.current?.setMap(null);
      measurePolyRef.current = null;
      setMeasuring(false);
      setAreaSqFt(null);
      return;
    }
    const [{ DrawingManager, OverlayType }, { spherical }] = await Promise.all([
      getLoader().importLibrary("drawing") as Promise<google.maps.DrawingLibrary>,
      getLoader().importLibrary("geometry") as Promise<google.maps.GeometryLibrary>,
    ]);
    sphericalRef.current = spherical;
    const dm = new DrawingManager({
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
  }, [measuring]);

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

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Address search (Places autocomplete) */}
      <div className="absolute top-3 left-3 z-10 w-72 max-w-[70%]">
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
        <Button size="sm" variant={streetOpen ? "default" : "outline"} className={btn} onClick={toggleStreet}>
          {streetOpen ? <X className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          Street
        </Button>
        <Button size="sm" variant={measuring ? "default" : "outline"} className={btn} onClick={toggleMeasure}>
          <Ruler className="h-3.5 w-3.5" />
          Measure
        </Button>
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

      {/* Route + distance readout */}
      {route && !streetOpen && (
        <div className="absolute bottom-3 right-3 z-10 bg-background/95 border border-border rounded-lg px-3 py-1.5 text-[11px] font-medium shadow-md flex items-center gap-1.5">
          <Navigation className="h-3.5 w-3.5 text-red-500" />
          {route.miles.toFixed(1)} mi from HQ · {Math.round(route.mins)} min drive
        </div>
      )}

      {/* Measurement readout */}
      {measuring && !streetOpen && (
        <div className="absolute bottom-3 left-3 z-10 bg-background/95 border border-border rounded-lg px-3 py-1.5 text-[11px] font-medium shadow-md">
          {areaSqFt != null ? (
            <>📐 {Math.round(areaSqFt).toLocaleString()} sq ft</>
          ) : (
            <>Draw a shape on the yard to measure it</>
          )}
        </div>
      )}

      {/* Focus label (when not measuring / no route panel below-left) */}
      {focusLabel && !measuring && (
        <div className="absolute bottom-3 left-3 z-10 bg-background/95 border border-border rounded-lg px-3 py-1.5 text-[11px] font-medium shadow-md max-w-[60%] truncate">
          📍 {focusLabel}
        </div>
      )}
    </div>
  );
}
