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

export interface AreaMapOptions {
  hqAddress?: string;
  hqLat?: number | null;
  hqLng?: number | null;
  serviceRadiusMiles?: number;
}

export function useAreaMap({ hqAddress, hqLat, hqLng, serviceRadiusMiles }: AreaMapOptions) {
  // Resolved HQ origin — from stored coords, else geocoded from the address at
  // boot (Bird's find: companies have an HQ address but often no lat/lng, so
  // radius/route/territory silently never drew). Resolve it once, everything
  // downstream keys off origin.current, not the raw props.
  const origin = useRef<{ lat: number; lng: number } | null>(
    hqLat != null && hqLng != null ? { lat: hqLat, lng: hqLng } : null,
  );

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
  const measurePoly = useRef<google.maps.Polygon | null>(null);
  const measureMarkers = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const measureClick = useRef<google.maps.MapsEventListener | null>(null);
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
  // While the user is typing an address, Google's suggestion dropdown owns
  // that corner — the stale verdict card must get out of its way.
  const [searchActive, setSearchActive] = useState(false);
  const [busy3d, setBusy3d] = useState(false);

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
        const at = focus ?? origin.current;
        if (!at) return;
        setBusy3d(true);
        const ok = await show3d(at);
        setBusy3d(false);
        if (!ok) return;
      }
      if (next === "street") {
        const at = focus ?? origin.current;
        if (!at || !panoRef.current) return;
        panoRef.current.setPosition(at);
        panoRef.current.setPov({ heading: 0, pitch: 0 });
        panoRef.current.setVisible(true);
        // A pano created inside a hidden 0×0 div renders BLACK — force a
        // resize + POV nudge once its container has real dimensions.
        setTimeout(() => {
          if (!panoRef.current) return;
          google.maps.event.trigger(panoRef.current, "resize");
          panoRef.current.setPov({ heading: 0, pitch: 5 });
        }, 60);
      } else {
        panoRef.current?.setVisible(false);
      }
      setModeState(next);
    },
    [focus, show3d],
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
      const o = origin.current;
      setVerdict(o ? qualify(o.lat, o.lng, lat, lng, serviceRadiusMiles) : null);

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
      if (o) {
        void (async () => {
          try {
            const { DirectionsService, DirectionsRenderer } = await importLibrary<google.maps.RoutesLibrary>("routes");
            if (token !== focusToken.current || !mapRef.current) return;
            if (!dirRenderer.current) {
              dirRenderer.current = new DirectionsRenderer({
                map: mapRef.current,
                suppressMarkers: false,
                // NEVER move the camera — landing on the house then yanking
                // out to frame the whole route read as "it jumps back to the
                // map" (Andrew). The route draws; the setter stays on the house.
                preserveViewport: true,
                polylineOptions: { strokeColor: "#ef4444", strokeWeight: 5, strokeOpacity: 0.9 },
              });
            }
            const res = await new DirectionsService().route({
              origin: { lat: o.lat, lng: o.lng },
              destination: { lat, lng },
              travelMode: google.maps.TravelMode.DRIVING,
            });
            if (token !== focusToken.current || !mapRef.current) return;
            dirRenderer.current.setDirections(res);
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
    [serviceRadiusMiles],
  );

  /* ── measure: draw a polygon, read square feet (map mode only) ── */

  const clearMeasureGeometry = useCallback(() => {
    measureClick.current?.remove();
    measureClick.current = null;
    measurePoly.current?.setMap(null);
    measurePoly.current = null;
    measureMarkers.current.forEach((mk) => (mk.map = null));
    measureMarkers.current = [];
  }, []);

  const exitMeasure = useCallback(() => {
    clearMeasureGeometry();
    setMeasuring(false);
    setAreaSqFt(null);
  }, [clearMeasureGeometry]);

  // Tap-to-drop corners → live sq-ft. DrawingManager was DELETED in Maps
  // v3.65, so this is hand-rolled from a Polygon + click handler — and it's
  // better: precise corner taps beat freehand, double-click/close to finish.
  const toggleMeasure = useCallback(async () => {
    if (measuring) {
      exitMeasure();
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    setModeState("map");
    panoRef.current?.setVisible(false);
    try {
      const { spherical } = await importLibrary<google.maps.GeometryLibrary>("geometry");
      if (!mapRef.current) return;
      const path: google.maps.LatLngLiteral[] = [];
      const poly = new google.maps.Polygon({
        map,
        paths: [],
        fillColor: "#2f6bff",
        fillOpacity: 0.18,
        strokeColor: "#2f6bff",
        strokeWeight: 2,
      });
      measurePoly.current = poly;
      const recompute = () => {
        poly.setPaths([path]);
        if (path.length >= 3) {
          const sqM = spherical.computeArea(
            path.map((p) => new google.maps.LatLng(p.lat, p.lng)),
          );
          setAreaSqFt(sqM * 10.7639);
        } else {
          setAreaSqFt(null);
        }
      };
      measureClick.current = map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        path.push({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        if (markerCtor.current) {
          const dot = document.createElement("div");
          dot.style.cssText = "width:14px;height:14px;border-radius:50%;background:#2f6bff;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);cursor:grab";
          const idx = path.length - 1;
          const mk = new markerCtor.current({ map, position: e.latLng, content: dot, gmpDraggable: true });
          // Drag a corner → the shape and sq-ft follow live.
          mk.addListener("drag", (ev: google.maps.MapMouseEvent) => {
            if (!ev.latLng) return;
            path[idx] = { lat: ev.latLng.lat(), lng: ev.latLng.lng() };
            recompute();
          });
          measureMarkers.current.push(mk);
        }
        recompute();
      });
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
        // StreetViewPanorama lives in the "streetView" library, NOT "maps"
        // (new functional API — verified live). Pulling it from maps = undefined
        // = "C is not a constructor". One import per home library.
        // Resolve the HQ origin first — geocode the address if coords are absent.
        if (!origin.current && hqAddress?.trim()) {
          try {
            const { Geocoder } = await importLibrary<google.maps.GeocodingLibrary>("geocoding");
            const { results } = await new Geocoder().geocode({ address: hqAddress });
            const loc = results?.[0]?.geometry?.location;
            if (loc) origin.current = { lat: loc.lat(), lng: loc.lng() };
          } catch { /* stays null → still renders, just no ring/route */ }
        }
        const hasHq = origin.current != null;
        const hqLatR = origin.current?.lat;
        const hqLngR = origin.current?.lng;

        const [{ Map }, { StreetViewPanorama }, { AdvancedMarkerElement }] = await Promise.all([
          importLibrary<google.maps.MapsLibrary>("maps"),
          importLibrary<google.maps.StreetViewLibrary>("streetView"),
          importLibrary<google.maps.MarkerLibrary>("marker"),
        ]);
        if (cancelled || !mapHost.current) return;
        markerCtor.current = AdvancedMarkerElement;

        const center = hasHq ? { lat: hqLatR as number, lng: hqLngR as number } : { lat: 39.5, lng: -98.35 };
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

  /* ── pre-warm 3D: build the Earth element while the user reads ── */
  // The maps3d library + photorealistic tiles take seconds to stream; doing
  // it on-click made 3D feel broken. Build it idle at the HQ so the switch
  // is near-instant (the host stays visibility-hidden, tiles stream behind).
  useEffect(() => {
    if (!ready) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => void };
    const idle = w.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 800));
    idle(() => {
      const at = origin.current;
      if (at && !threeRef.current) void show3d(at);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

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
        // Typing opens Google's suggestion dropdown right where the verdict
        // card sits — flag it so the card yields until a pick or blur.
        const host = searchHost.current;
        host.addEventListener("focusin", () => setSearchActive(true));
        host.addEventListener("focusout", (e: FocusEvent) => {
          if (!(e.relatedTarget instanceof Node) || !host.contains(e.relatedTarget)) setSearchActive(false);
        });
        el.addEventListener("gmp-select", async (e: unknown) => {
          setSearchActive(false);
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
    busy3d,
    searchActive,
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
