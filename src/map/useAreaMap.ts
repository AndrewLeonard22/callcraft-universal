// The Area cockpit's engine — one mode machine, one focus pipeline.
// Rebuilt from first principles per docs/AREA-REBUILD.md: ring/route/markers/
// measure exist ONLY in "map" mode; picking an address forces map+fitBounds;
// boot prefers 3D and falls back gracefully. Every Google failure surfaces.
import { useCallback, useEffect, useRef, useState } from "react";
import { importLibrary, MAP_ID } from "./loader";
import { qualify, type Verdict } from "./qualify";

export type AreaMode = "3d" | "map" | "street";

export interface Focus {
  lat: number;
  lng: number;
  label: string | null;
}

export interface RouteInfo {
  miles: number;
  mins: number;
}

export interface HomeValue {
  value: number;
  low: number | null;
  high: number | null;
}

interface Map3DEl extends HTMLElement {
  center: { lat: number; lng: number; altitude: number };
}

interface DrawMgr {
  setMap(map: google.maps.Map | null): void;
  setDrawingMode(mode: unknown): void;
  addListener(event: string, cb: (...args: unknown[]) => void): google.maps.MapsEventListener;
}

export interface AreaMapOptions {
  hqLat?: number | null;
  hqLng?: number | null;
  serviceRadiusMiles?: number;
}

export function useAreaMap({ hqLat, hqLng, serviceRadiusMiles }: AreaMapOptions) {
  const hasHq = hqLat != null && hqLng != null;

  const mapHost = useRef<HTMLDivElement>(null);
  const streetHost = useRef<HTMLDivElement>(null);
  const threeHost = useRef<HTMLDivElement>(null);
  const searchHost = useRef<HTMLDivElement>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const threeRef = useRef<Map3DEl | null>(null);
  const markerCtor = useRef<typeof google.maps.marker.AdvancedMarkerElement | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const dirRenderer = useRef<google.maps.DirectionsRenderer | null>(null);
  const drawMgr = useRef<DrawMgr | null>(null);
  const focusToken = useRef(0);

  const [ready, setReady] = useState(false);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [mode, setModeState] = useState<AreaMode>("map");
  const [threeDAvailable, setThreeDAvailable] = useState(true);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [homeValue, setHomeValue] = useState<HomeValue | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [areaSqFt, setAreaSqFt] = useState<number | null>(null);

  /* ── mode machine ─────────────────────────────────────────────── */

  const show3d = useCallback(async (at: { lat: number; lng: number }): Promise<boolean> => {
    try {
      if (!threeRef.current) {
        const { Map3DElement } = (await importLibrary<{ Map3DElement: new (o: unknown) => Map3DEl }>("maps3d"));
        if (!threeHost.current) return false;
        const el = new Map3DElement({ center: { ...at, altitude: 0 }, range: 450, tilt: 62 });
        el.style.width = "100%";
        el.style.height = "100%";
        threeHost.current.appendChild(el);
        threeRef.current = el;
      } else {
        threeRef.current.center = { ...at, altitude: 0 };
      }
      return true;
    } catch {
      setThreeDAvailable(false);
      return false;
    }
  }, []);

  const setMode = useCallback(
    async (next: AreaMode) => {
      if (next === "3d") {
        const at = focus ?? (hasHq ? { lat: hqLat as number, lng: hqLng as number } : null);
        if (!at) return;
        const ok = await show3d(at);
        if (!ok) return;
      }
      if (next === "street") {
        const at = focus ?? (hasHq ? { lat: hqLat as number, lng: hqLng as number } : null);
        if (!at || !panoRef.current) return;
        panoRef.current.setPosition(at);
        panoRef.current.setVisible(true);
      } else {
        panoRef.current?.setVisible(false);
      }
      setModeState(next);
    },
    [focus, hasHq, hqLat, hqLng, show3d],
  );

  /* ── the focus pipeline: ONE way an address becomes qualified ─── */

  const focusAddress = useCallback(
    (lat: number, lng: number, label: string | null) => {
      const token = ++focusToken.current;
      const map = mapRef.current;
      if (!map) return;

      setFocus({ lat, lng, label });
      setAreaSqFt(null);
      setHomeValue(null);
      setRoute(null);
      setVerdict(hasHq ? qualify(hqLat as number, hqLng as number, lat, lng, serviceRadiusMiles) : null);

      // qualification happens on the MAP — route, ring and pins live there
      setModeState("map");
      panoRef.current?.setVisible(false);

      if (markerCtor.current) {
        if (markerRef.current) markerRef.current.map = null;
        markerRef.current = new markerCtor.current({ map, position: { lat, lng } });
      }
      map.setCenter({ lat, lng });
      map.setZoom(19);
      if (threeRef.current) threeRef.current.center = { lat, lng, altitude: 0 };
      panoRef.current?.setPosition({ lat, lng });

      // the red drive, framed whole
      if (hasHq) {
        void (async () => {
          try {
            const { DirectionsService, DirectionsRenderer } = await importLibrary<google.maps.RoutesLibrary>("routes");
            if (token !== focusToken.current || !mapRef.current) return;
            if (!dirRenderer.current) {
              dirRenderer.current = new DirectionsRenderer({
                map: mapRef.current,
                suppressMarkers: false,
                polylineOptions: { strokeColor: "#ef4444", strokeWeight: 5, strokeOpacity: 0.9 },
              });
            }
            const res = await new DirectionsService().route({
              origin: { lat: hqLat as number, lng: hqLng as number },
              destination: { lat, lng },
              travelMode: google.maps.TravelMode.DRIVING,
            });
            if (token !== focusToken.current || !mapRef.current) return;
            dirRenderer.current.setDirections(res);
            if (res.routes[0]?.bounds) mapRef.current.fitBounds(res.routes[0].bounds, 70);
            const leg = res.routes[0]?.legs[0];
            if (leg?.distance && leg?.duration) {
              setRoute({ miles: leg.distance.value / 1609.34, mins: leg.duration.value / 60 });
            }
          } catch {
            dirRenderer.current?.setMap(null);
            dirRenderer.current = null;
          }
        })();
      }

      // home value rides the same token so stale picks never paint
      if (label) {
        fetch(`/api/home-value?address=${encodeURIComponent(label)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (token !== focusToken.current) return;
            if (d && typeof d.value === "number") setHomeValue({ value: d.value, low: d.low, high: d.high });
          })
          .catch(() => {});
      }
    },
    [hasHq, hqLat, hqLng, serviceRadiusMiles],
  );

  /* ── measure: draw a polygon, read square feet (map mode only) ── */

  const exitMeasure = useCallback(() => {
    drawMgr.current?.setDrawingMode(null);
    drawMgr.current?.setMap(null);
    drawMgr.current = null;
    setMeasuring(false);
  }, []);

  const toggleMeasure = useCallback(async () => {
    if (measuring) {
      exitMeasure();
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    setModeState("map"); // drawing lives on the 2D map
    panoRef.current?.setVisible(false);
    try {
      const [{ DrawingManager, OverlayType }, { spherical }] = await Promise.all([
        importLibrary<google.maps.DrawingLibrary>("drawing"),
        importLibrary<google.maps.GeometryLibrary>("geometry"),
      ]);
      if (!mapRef.current) return;
      const dm = new (DrawingManager as unknown as new (o: unknown) => DrawMgr)({
        drawingMode: OverlayType.POLYGON,
        drawingControl: false,
        polygonOptions: { fillColor: "#2f6bff", fillOpacity: 0.18, strokeColor: "#2f6bff", strokeWeight: 2 },
      });
      dm.setMap(mapRef.current);
      dm.addListener("polygoncomplete", (...args: unknown[]) => {
        const poly = args[0] as google.maps.Polygon;
        const sqMeters = spherical.computeArea(poly.getPath());
        setAreaSqFt(sqMeters * 10.7639);
        dm.setDrawingMode(null);
        poly.addListener("click", () => poly.setMap(null));
      });
      drawMgr.current = dm;
      setMeasuring(true);
      setAreaSqFt(null);
    } catch (e) {
      setFailReason(`Measure tools failed: ${String(e).slice(0, 140)}`);
    }
  }, [measuring, exitMeasure]);

  /* ── boot ─────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        (window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
          setFailReason(
            "Google rejected the key at runtime (gm_authFailure) — usually 'Maps JavaScript API' not enabled on the key's project, or this site missing from the key's website restrictions.",
          );
        };
        const [{ Map, StreetViewPanorama }, { AdvancedMarkerElement }] = await Promise.all([
          importLibrary<google.maps.MapsLibrary>("maps"),
          importLibrary<google.maps.MarkerLibrary>("marker"),
        ]);
        if (cancelled || !mapHost.current) return;
        markerCtor.current = AdvancedMarkerElement;

        const center = hasHq ? { lat: hqLat as number, lng: hqLng as number } : { lat: 39.5, lng: -98.35 };
        const map = new Map(mapHost.current, {
          center,
          zoom: hasHq ? 12 : 4,
          mapId: MAP_ID,
          mapTypeId: "hybrid",
          tilt: 45,
          gestureHandling: "greedy",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;

        if (hasHq) {
          const ring = new google.maps.Circle({
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
          // Boot = the client's TERRITORY (Andrew): the whole radius, edge to
          // edge, before any search. 3D stays one click away on the switcher.
          const b = ring.getBounds();
          if (b) map.fitBounds(b, 40);
        }

        if (streetHost.current) {
          const pano = new StreetViewPanorama(streetHost.current, {
            visible: false,
            enableCloseButton: false,
            addressControl: false,
          });
          panoRef.current = pano;
          map.setStreetView(pano);
          if (hasHq) pano.setPosition(center);
        }

        setReady(true);
      } catch (e) {
        if (!cancelled) setFailReason(`Maps JS failed to load: ${String(e).slice(0, 180)}`);
      }
    })();
    return () => {
      cancelled = true;
      threeRef.current?.remove();
      threeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── search: Places autocomplete mounts into the host ─────────── */

  useEffect(() => {
    if (!ready || !searchHost.current) return;
    let el: HTMLElement | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const { PlaceAutocompleteElement } = await importLibrary<google.maps.PlacesLibrary>("places");
        if (cancelled || !searchHost.current) return;
        el = new PlaceAutocompleteElement({ includedRegionCodes: ["us"] }) as unknown as HTMLElement;
        el.style.width = "100%";
        searchHost.current.appendChild(el);
        el.addEventListener("gmp-select", async (e: unknown) => {
          const prediction = (e as { placePrediction?: { toPlace: () => google.maps.places.Place } }).placePrediction;
          if (!prediction) return;
          const place = prediction.toPlace();
          await place.fetchFields({ fields: ["formattedAddress", "location"] });
          const loc = place.location;
          if (loc) focusAddress(loc.lat(), loc.lng(), place.formattedAddress ?? null);
        });
      } catch (e) {
        setFailReason(`Address search failed to mount: ${String(e).slice(0, 140)}`);
      }
    })();
    return () => {
      cancelled = true;
      el?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return {
    hosts: { mapHost, streetHost, threeHost, searchHost },
    ready,
    failReason,
    mode,
    setMode,
    threeDAvailable,
    focus,
    verdict,
    route,
    homeValue,
    measuring,
    toggleMeasure,
    areaSqFt,
    focusAddress,
  };
}
