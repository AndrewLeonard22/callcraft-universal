import { useState, useRef, useEffect } from "react";
import { Ban, CheckCircle, AlertTriangle, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

interface ZipCheckerProps {
  excludedZips: string[];
  clientCity?: string;
  clientAddress?: string;
  serviceRadiusMiles?: number;
  hqLat?: number;
  hqLng?: number;
}

type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "excluded"; location: string }
  | { status: "in_range"; location: string; distanceMiles: number }
  | { status: "out_of_range"; location: string; distanceMiles: number }
  | { status: "error"; message: string };

const haversineDistance = (
  [lon1, lat1]: [number, number],
  [lon2, lat2]: [number, number]
): number => {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function circleGeoJSON(lng: number, lat: number, radiusMiles: number) {
  const pts = 64;
  const coords = Array.from({ length: pts + 1 }, (_, i) => {
    const angle = (i / pts) * 2 * Math.PI;
    const dLat = (radiusMiles / 69) * Math.cos(angle);
    const dLng = (radiusMiles / 69 / Math.cos((lat * Math.PI) / 180)) * Math.sin(angle);
    return [lng + dLng, lat + dLat];
  });
  return {
    type: "Feature" as const,
    geometry: { type: "Polygon" as const, coordinates: [coords] },
    properties: {},
  };
}

interface MiniMapProps {
  hqCoords: [number, number];
  leadCoords: [number, number] | null;
  serviceRadiusMiles: number;
  status: "in_range" | "out_of_range" | "excluded" | null;
}

function MiniMap({ hqCoords, leadCoords, serviceRadiusMiles, status }: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leadMarkerRef = useRef<any>(null);
  const connectorAddedRef = useRef(false);

  // Init map once on mount
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;

      if (!document.getElementById("mapbox-css")) {
        const link = document.createElement("link");
        link.id = "mapbox-css";
        link.rel = "stylesheet";
        link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
        document.head.appendChild(link);
      }

      const token = localStorage.getItem("MAPBOX_PUBLIC_TOKEN") || "";
      if (!token) return;
      mapboxgl.accessToken = token;

      const padDeg = (serviceRadiusMiles / 69) * 1.5;
      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/light-v11",
        center: hqCoords,
        zoom: 9,
        interactive: true,
        attributionControl: false,
      });
      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        if (cancelled) return;

        // Fit to radius circle bounds
        map.fitBounds(
          [
            [hqCoords[0] - padDeg * 1.1, hqCoords[1] - padDeg],
            [hqCoords[0] + padDeg * 1.1, hqCoords[1] + padDeg],
          ],
          { padding: 20, animate: false }
        );

        // Service radius circle
        map.addSource("radius", {
          type: "geojson",
          data: circleGeoJSON(hqCoords[0], hqCoords[1], serviceRadiusMiles),
        });
        map.addLayer({
          id: "radius-fill",
          type: "fill",
          source: "radius",
          paint: { "fill-color": "#22c55e", "fill-opacity": 0.09 },
        });
        map.addLayer({
          id: "radius-line",
          type: "line",
          source: "radius",
          paint: { "line-color": "#16a34a", "line-width": 2, "line-dasharray": [5, 3] },
        });

        // HQ marker
        const hqEl = document.createElement("div");
        hqEl.style.cssText =
          "width:12px;height:12px;border-radius:50%;background:#166534;border:2px solid white;box-shadow:0 1px 5px rgba(0,0,0,.4);cursor:default;";
        new mapboxgl.Marker({ element: hqEl })
          .setLngLat(hqCoords)
          .setPopup(
            new mapboxgl.Popup({ closeButton: false, offset: 10 }).setHTML(
              `<span style="font-size:11px;font-weight:600;font-family:system-ui">HQ</span>`
            )
          )
          .addTo(map);

        // Placeholder sources for lead + connector (updated when leadCoords changes)
        map.addSource("connector", {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
        });
        map.addLayer({
          id: "connector-line",
          type: "line",
          source: "connector",
          paint: { "line-color": "#6b7280", "line-width": 1.5, "line-dasharray": [3, 2], "line-opacity": 0.5 },
        });
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hqCoords[0], hqCoords[1], serviceRadiusMiles]);

  // Update lead marker + connector when leadCoords/status changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old lead marker
    if (leadMarkerRef.current) {
      leadMarkerRef.current.remove();
      leadMarkerRef.current = null;
    }

    if (!leadCoords) return;

    const addLeadToMap = () => {
      const mapboxgl = (window as any).mapboxgl;
      if (!mapboxgl && !map) return;

      const leadColor =
        status === "excluded" ? "#ef4444" : status === "in_range" ? "#22c55e" : "#f59e0b";

      // Lead marker
      const leadEl = document.createElement("div");
      leadEl.style.cssText = `width:14px;height:14px;border-radius:50%;background:${leadColor};border:2.5px solid white;box-shadow:0 1px 6px rgba(0,0,0,.4);`;

      // Use the already-loaded mapboxgl from the dynamic import
      import("mapbox-gl").then(({ default: mgl }) => {
        if (!mapRef.current) return;
        leadMarkerRef.current = new mgl.Marker({ element: leadEl })
          .setLngLat(leadCoords)
          .addTo(mapRef.current);

        // Update connector line
        if (map.getSource("connector")) {
          (map.getSource("connector") as any).setData({
            type: "Feature",
            geometry: { type: "LineString", coordinates: [hqCoords, leadCoords] },
            properties: {},
          });
          if (map.getLayer("connector-line")) {
            map.setPaintProperty("connector-line", "line-color", leadColor);
            map.setPaintProperty("connector-line", "line-opacity", 0.5);
          }
        }

        // Fly to fit both points
        const padDeg = (serviceRadiusMiles / 69) * 1.4;
        map.fitBounds(
          [
            [Math.min(hqCoords[0], leadCoords[0]) - padDeg, Math.min(hqCoords[1], leadCoords[1]) - padDeg],
            [Math.max(hqCoords[0], leadCoords[0]) + padDeg, Math.max(hqCoords[1], leadCoords[1]) + padDeg],
          ],
          { padding: 32, duration: 800 }
        );
      });
    };

    if (map.isStyleLoaded()) {
      addLeadToMap();
    } else {
      map.once("load", addLeadToMap);
    }
  }, [leadCoords, status]);

  return (
    <div
      ref={containerRef}
      className="mt-2.5 h-[220px] w-full rounded-lg overflow-hidden border border-border shadow-sm"
    />
  );
}

export function ZipChecker({
  excludedZips,
  clientCity,
  clientAddress,
  serviceRadiusMiles = 30,
  hqLat,
  hqLng,
}: ZipCheckerProps) {
  const [input, setInput] = useState("");
  const [state, setState] = useState<CheckState>({ status: "idle" });
  const [leadCoords, setLeadCoords] = useState<[number, number] | null>(null);
  const [resolvedHqCoords, setResolvedHqCoords] = useState<[number, number] | null>(
    hqLat != null && hqLng != null ? [hqLng, hqLat] : null
  );
  const tokenRef = useRef<string | null>(
    typeof localStorage !== "undefined"
      ? localStorage.getItem("MAPBOX_PUBLIC_TOKEN")
      : null
  );

  const getToken = async (): Promise<string | null> => {
    if (tokenRef.current) return tokenRef.current;
    try {
      const { data } = await supabase.functions.invoke("get-mapbox-token");
      if (data?.token) {
        tokenRef.current = data.token;
        localStorage.setItem("MAPBOX_PUBLIC_TOKEN", data.token);
        return data.token;
      }
    } catch (e) {
      logger.error("Failed to get Mapbox token", e);
    }
    return null;
  };

  const check = async () => {
    const query = input.trim();
    if (!query) return;

    const isZip = /^\d{5}(-\d{4})?$/.test(query);

    if (isZip && excludedZips.includes(query)) {
      setState({ status: "excluded", location: query });
      setLeadCoords(null);
      return;
    }

    const token = await getToken();
    if (!token) {
      if (isZip && !excludedZips.includes(query)) {
        setState({ status: "in_range", location: query, distanceMiles: 0 });
      } else {
        setState({ status: "error", message: "Map token unavailable — can only check excluded zips." });
      }
      return;
    }

    setState({ status: "checking" });
    setLeadCoords(null);

    try {
      const leadRes = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}`
      );
      const leadData = await leadRes.json();
      const leadCenter = leadData.features?.[0]?.center as [number, number] | undefined;
      const locationName: string =
        leadData.features?.[0]?.place_name?.split(",")[0] ?? query;

      if (!leadCenter) {
        setState({ status: "error", message: `Could not find "${query}". Try a zip code.` });
        return;
      }

      const normalizedName = locationName.toLowerCase();
      const cityExcluded = excludedZips.some(
        (z) => z.toLowerCase() === normalizedName || normalizedName.includes(z.toLowerCase())
      );
      if (cityExcluded) {
        setState({ status: "excluded", location: locationName });
        setLeadCoords(leadCenter);
        return;
      }

      // Resolve HQ coords
      let hqCenter: [number, number] | null =
        hqLat != null && hqLng != null ? [hqLng, hqLat] : null;

      if (!hqCenter) {
        const centerQuery = clientAddress || clientCity;
        if (centerQuery) {
          const centerRes = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(centerQuery)}.json?access_token=${token}`
          );
          const centerData = await centerRes.json();
          hqCenter = centerData.features?.[0]?.center as [number, number] | undefined ?? null;
        }
      }

      if (!hqCenter) {
        setState({ status: "in_range", location: locationName, distanceMiles: 0 });
        setLeadCoords(leadCenter);
        return;
      }

      setResolvedHqCoords(hqCenter);
      const distanceMiles = Math.round(haversineDistance(hqCenter, leadCenter));
      const inRange = distanceMiles <= serviceRadiusMiles;

      setState({
        status: inRange ? "in_range" : "out_of_range",
        location: locationName,
        distanceMiles,
      });
      setLeadCoords(leadCenter);
    } catch (e) {
      logger.error("ZipChecker error", e);
      setState({ status: "error", message: "Check failed. Try again." });
    }
  };

  const showMap = resolvedHqCoords != null;

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setState({ status: "idle" });
            setLeadCoords(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="Zip, city, or address..."
          className="h-8 text-[13px]"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={check}
          disabled={state.status === "checking" || !input.trim()}
          className="h-8 px-2 shrink-0"
        >
          {state.status === "checking" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {state.status === "excluded" && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-md text-[13px] font-medium">
          <Ban className="h-4 w-4 shrink-0" />
          <span>
            <strong>{state.location}</strong> — excluded zone. Do not set appointment.
          </span>
        </div>
      )}

      {state.status === "in_range" && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-md text-[13px]">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{state.location}</strong>
            {state.distanceMiles > 0 && ` — ${state.distanceMiles} mi`}
            {" "}within service area
          </span>
        </div>
      )}

      {state.status === "out_of_range" && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-md text-[13px]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{state.location}</strong> — {state.distanceMiles} mi away,
            outside {serviceRadiusMiles} mi radius.
          </span>
        </div>
      )}

      {state.status === "error" && (
        <p className="text-[12px] text-muted-foreground px-1">{state.message}</p>
      )}

      {showMap && (
        <MiniMap
          hqCoords={resolvedHqCoords!}
          leadCoords={leadCoords}
          serviceRadiusMiles={serviceRadiusMiles}
          status={
            state.status === "in_range" || state.status === "out_of_range" || state.status === "excluded"
              ? state.status
              : null
          }
        />
      )}
    </div>
  );
}
