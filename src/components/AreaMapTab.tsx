// AreaMapTab — Pass 3 of the Agent IQ map redesign.
// Lazy-loads mapbox-gl (not in main bundle). Renders:
//   Left rail: stat tiles, zip/city checker, layer toggles, excluded list, today's appts
//   Map canvas: service-radius circle, excluded bbox polygons, HQ pin, appt markers,
//               pulsing live-lead marker, popup on click

import {
  useState, useEffect, useRef, useCallback, lazy, Suspense,
} from "react";
import { Search, Loader2, X, CheckCircle, AlertTriangle, MapPin, ToggleLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";
import { lookupArea, type AreaLookupResult, type ExcludedArea, type ClientAreaConfig } from "@/utils/areaLookup";

// ── Types ─────────────────────────────────────────────────────────────────

export interface LiveLead {
  id: string;
  number?: string;       // "Lead #4821"
  address?: string;
  city?: string;
  callDurationSecs?: number;
  lng: number;
  lat: number;
}

export interface TodayAppt {
  id: string;
  number: number;
  name: string;
  city: string;
  serviceLabel: string;
  time: string;          // "10:00 AM"
  flagged?: boolean;
  flagNote?: string;
  lng: number;
  lat: number;
}

interface AreaMapTabProps {
  // Client config
  hqLat?: number | null;
  hqLng?: number | null;
  hqAddress?: string;
  serviceRadiusMiles?: number;
  excludedAreas?: ExcludedArea[];
  excludedZips?: string[];   // legacy fallback
  clientCity?: string;

  // Live data (optional — caller provides if wired to Airtable/realtime)
  liveLead?: LiveLead | null;
  todayAppts?: TodayAppt[];
}

// ── Token helper ──────────────────────────────────────────────────────────

async function getMapboxToken(): Promise<string | null> {
  const cached = localStorage.getItem("MAPBOX_PUBLIC_TOKEN");
  if (cached) return cached;
  try {
    const { data } = await supabase.functions.invoke("get-mapbox-token");
    if (data?.token) {
      localStorage.setItem("MAPBOX_PUBLIC_TOKEN", data.token);
      return data.token;
    }
  } catch (e) {
    logger.error("Failed to get Mapbox token", e);
  }
  return null;
}

function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Zip / City checker (uses Pass-1 lookupArea when config is present) ────

interface ZipCheckerRailProps {
  config: ClientAreaConfig | null;
  excludedZips: string[];  // legacy
  clientCity?: string;
}

function ZipCheckerRail({ config, excludedZips, clientCity }: ZipCheckerRailProps) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AreaLookupResult | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    const q = input.trim();
    if (!q) return;
    setChecking(true);
    setResult(null);
    try {
      if (config) {
        const token = await getMapboxToken();
        if (token) {
          const r = await lookupArea(q, config, token);
          setResult(r);
          setChecking(false);
          return;
        }
      }
      // Legacy fallback: just check excludedZips array
      const isZip = /^\d{5}/.test(q);
      if (isZip && excludedZips.includes(q.slice(0, 5))) {
        setResult({ status: "excluded", label: q });
      } else {
        setResult({ status: "unknown" });
      }
    } finally {
      setChecking(false);
    }
  };

  const statusUI = () => {
    if (!result) return null;
    if (result.status === "excluded") {
      return (
        <div className="rounded-md bg-red-50 border border-red-200 p-2.5 flex gap-2">
          <X className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-[12px] font-semibold text-red-700">Disqualified Area</div>
            <div className="text-[11px] text-red-600 leading-snug mt-0.5">
              {result.area ? `${result.area.label} is on the excluded list.` : "This area is excluded."} Do not book.
              Thank lead, inform politely, move on.
            </div>
            {result.distance_miles != null && (
              <div className="text-[10px] text-red-500 mt-1">{result.distance_miles} mi from HQ</div>
            )}
          </div>
        </div>
      );
    }
    if (result.status === "outside") {
      return (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-2.5 flex gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-[12px] font-semibold text-amber-700">Outside Service Area</div>
            <div className="text-[11px] text-amber-600 leading-snug mt-0.5">
              {result.distance_miles != null ? `${result.distance_miles} mi from HQ — ` : ""}
              Outside the {config?.service_radius_miles ?? "?"} mi radius.
            </div>
          </div>
        </div>
      );
    }
    if (result.status === "ok") {
      return (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2.5 flex gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-[12px] font-semibold text-emerald-700">In Service Area</div>
            {result.distance_miles != null && (
              <div className="text-[11px] text-emerald-600 mt-0.5">{result.distance_miles} mi from HQ</div>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-md bg-muted p-2.5 text-[11px] text-muted-foreground">
        Could not resolve location. Try a zip code.
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Check a Zip or City
      </div>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && check()}
            placeholder="98055 or Renton, WA"
            className="pl-8 h-8 text-[12px]"
          />
        </div>
        <Button size="sm" variant="outline" onClick={check} disabled={checking} className="h-8 px-2.5">
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Go"}
        </Button>
      </div>
      {statusUI()}
    </div>
  );
}

// ── Map canvas (lazy mapbox-gl) ────────────────────────────────────────────

// We dynamically import mapbox-gl only when the Area tab is opened.
// The heavy bundle (~800KB) is never in the main chunk.

interface MapCanvasProps {
  token: string;
  hqLat: number;
  hqLng: number;
  serviceRadiusMiles: number;
  excludedAreas: ExcludedArea[];
  liveLead?: LiveLead | null;
  todayAppts?: TodayAppt[];
  layers: LayerToggles;
  onLeadClick?: () => void;
  onApptClick?: (appt: TodayAppt) => void;
}

// Approximate degrees of latitude for a given mile distance
function milesToDeg(miles: number) { return miles / 69; }

// Build a GeoJSON polygon approximating a circle (32-point)
function circleGeoJSON(lng: number, lat: number, radiusMiles: number) {
  const pts = 64;
  const coords = Array.from({ length: pts + 1 }, (_, i) => {
    const angle = (i / pts) * 2 * Math.PI;
    const dLat = milesToDeg(radiusMiles) * Math.cos(angle);
    const dLng = (milesToDeg(radiusMiles) / Math.cos((lat * Math.PI) / 180)) * Math.sin(angle);
    return [lng + dLng, lat + dLat];
  });
  return { type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [coords] }, properties: {} };
}

// Build GeoJSON polygon from a bbox [west, south, east, north]
function bboxToGeoJSON(bbox: [number, number, number, number], label: string) {
  const [w, s, e, n] = bbox;
  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
    },
    properties: { label },
  };
}

interface LayerToggles {
  serviceBoundary: boolean;
  excludedAreas: boolean;
  todayAppts: boolean;
  currentLead: boolean;
}

function MapCanvas({
  token, hqLat, hqLng, serviceRadiusMiles, excludedAreas,
  liveLead, todayAppts = [], layers, onLeadClick, onApptClick,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const pulseRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let map: any;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;

      // Load mapbox CSS once
      if (!document.getElementById("mapbox-css")) {
        const link = document.createElement("link");
        link.id = "mapbox-css";
        link.rel = "stylesheet";
        link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
        document.head.appendChild(link);
      }

      mapboxgl.accessToken = token;
      map = new mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/light-v11",
        center: [hqLng, hqLat],
        zoom: 10,
      });
      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        if (cancelled) return;

        // ── Service boundary circle ────────────────────────────────
        map.addSource("service-boundary", {
          type: "geojson",
          data: circleGeoJSON(hqLng, hqLat, serviceRadiusMiles),
        });
        map.addLayer({
          id: "service-boundary-fill",
          type: "fill",
          source: "service-boundary",
          paint: { "fill-color": "#22c55e", "fill-opacity": 0.06 },
          layout: { visibility: layers.serviceBoundary ? "visible" : "none" },
        });
        map.addLayer({
          id: "service-boundary-line",
          type: "line",
          source: "service-boundary",
          paint: { "line-color": "#16a34a", "line-width": 2, "line-dasharray": [4, 3] },
          layout: { visibility: layers.serviceBoundary ? "visible" : "none" },
        });

        // ── Excluded area polygons ─────────────────────────────────
        const excludedFC = {
          type: "FeatureCollection" as const,
          features: excludedAreas.map(a => bboxToGeoJSON(a.bbox, a.label)),
        };
        map.addSource("excluded-areas", { type: "geojson", data: excludedFC });
        map.addLayer({
          id: "excluded-areas-fill",
          type: "fill",
          source: "excluded-areas",
          paint: { "fill-color": "#ef4444", "fill-opacity": 0.12 },
          layout: { visibility: layers.excludedAreas ? "visible" : "none" },
        });
        map.addLayer({
          id: "excluded-areas-line",
          type: "line",
          source: "excluded-areas",
          paint: {
            "line-color": "#dc2626",
            "line-width": 1.5,
            "line-dasharray": [3, 2],
          },
          layout: { visibility: layers.excludedAreas ? "visible" : "none" },
        });

        // ── HQ marker ─────────────────────────────────────────────
        const hqEl = document.createElement("div");
        hqEl.className = "hq-marker";
        hqEl.style.cssText = `width:14px;height:14px;border-radius:50%;background:#166534;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);`;
        new mapboxgl.Marker({ element: hqEl }).setLngLat([hqLng, hqLat]).addTo(map);
        new mapboxgl.Popup({ closeButton: false, className: "hq-popup" })
          .setLngLat([hqLng, hqLat])
          .setHTML(`<span style="font-size:11px;font-weight:600">HQ</span>`)
          .addTo(map);

        // ── Today's appointment markers ────────────────────────────
        todayAppts.forEach(appt => {
          const el = document.createElement("div");
          el.style.cssText = `
            width:28px;height:28px;border-radius:50%;
            background:${appt.flagged ? "#f97316" : "#3b82f6"};
            color:white;font-size:12px;font-weight:700;
            display:flex;align-items:center;justify-content:center;
            border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.25);
            cursor:pointer;
          `;
          el.textContent = String(appt.number);
          el.addEventListener("click", () => onApptClick?.(appt));
          new mapboxgl.Marker({ element: el }).setLngLat([appt.lng, appt.lat]).addTo(map);
        });

        // ── Live lead marker (pulsing) ─────────────────────────────
        if (liveLead) {
          const pulseEl = document.createElement("div");
          pulseEl.style.cssText = `
            width:22px;height:22px;border-radius:50%;
            background:#f97316;border:2px solid white;
            box-shadow:0 0 0 0 rgba(249,115,22,.6);
            cursor:pointer;
          `;
          let scale = 0;
          pulseRef.current = setInterval(() => {
            scale = scale === 0 ? 8 : 0;
            pulseEl.style.boxShadow = `0 0 0 ${scale}px rgba(249,115,22,0)`;
          }, 800);
          pulseEl.addEventListener("click", () => onLeadClick?.());
          new mapboxgl.Marker({ element: pulseEl }).setLngLat([liveLead.lng, liveLead.lat]).addTo(map);
        }
      });
    })();

    return () => {
      cancelled = true;
      if (pulseRef.current) clearInterval(pulseRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // Only init once — layer visibility changes handled separately
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hqLat, hqLng, serviceRadiusMiles]);

  // Sync layer visibility on toggle changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const vis = (on: boolean) => (on ? "visible" : "none") as "visible" | "none";
    const safeSet = (layer: string, prop: string, val: any) => {
      if (map.getLayer(layer)) map.setLayoutProperty(layer, prop, val);
    };
    safeSet("service-boundary-fill", "visibility", vis(layers.serviceBoundary));
    safeSet("service-boundary-line", "visibility", vis(layers.serviceBoundary));
    safeSet("excluded-areas-fill", "visibility", vis(layers.excludedAreas));
    safeSet("excluded-areas-line", "visibility", vis(layers.excludedAreas));
  }, [layers]);

  return <div ref={containerRef} className="h-full w-full" />;
}

// ── Main AreaMapTab ────────────────────────────────────────────────────────

export function AreaMapTab({
  hqLat, hqLng, hqAddress, serviceRadiusMiles = 30,
  excludedAreas = [], excludedZips = [], clientCity,
  liveLead, todayAppts = [],
}: AreaMapTabProps) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [layers, setLayers] = useState<LayerToggles>({
    serviceBoundary: true,
    excludedAreas: true,
    todayAppts: true,
    currentLead: true,
  });
  const [selectedAppt, setSelectedAppt] = useState<TodayAppt | null>(null);
  const [leadPopupOpen, setLeadPopupOpen] = useState(false);

  useEffect(() => {
    getMapboxToken().then(t => {
      setToken(t);
      setTokenLoading(false);
    });
  }, []);

  const hasHq = !!(hqLat && hqLng);

  const config: ClientAreaConfig | null = hasHq
    ? {
        hq_lat: hqLat!,
        hq_lng: hqLng!,
        hq_address: hqAddress ?? "",
        service_radius_miles: serviceRadiusMiles,
        excluded_areas: excludedAreas,
      }
    : null;

  const toggleLayer = (key: keyof LayerToggles) =>
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Stat tiles ─────────────────────────────────────────────────────────
  const flaggedCount = todayAppts.filter(a => a.flagged).length;
  const leadStatus = liveLead && config
    ? excludedAreas.some(a => {
        const [lng, lat] = [liveLead.lng, liveLead.lat];
        const [w, s, e, n] = a.bbox;
        return lng >= w && lng <= e && lat >= s && lat <= n;
      })
      ? "in excluded zone"
      : "in service area"
    : null;

  return (
    <div className="flex h-full min-h-0">

      {/* ── LEFT RAIL ─────────────────────────────────────────────────── */}
      <div className="w-[220px] shrink-0 border-r border-border bg-background overflow-y-auto flex flex-col">

        {/* Stat tiles */}
        <div className="grid grid-cols-2 border-b border-border divide-x divide-border">
          {/* Service radius */}
          <div className="p-3">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Service Radius</div>
            <div className="text-[20px] font-bold text-foreground leading-tight mt-0.5">{serviceRadiusMiles} mi</div>
            {hqAddress && <div className="text-[10px] text-muted-foreground truncate">from {hqAddress}</div>}
          </div>
          {/* Excluded areas */}
          <div className="p-3">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Excluded</div>
            <div className="text-[20px] font-bold text-foreground leading-tight mt-0.5">{excludedAreas.length}</div>
            {excludedAreas.length > 0 && (
              <div className="text-[10px] text-muted-foreground truncate">
                {excludedAreas.slice(0, 2).map(a => a.label.split(",")[0]).join(", ")}
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 border-b border-border divide-x divide-border">
          {/* Today's appts */}
          <div className="p-3">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Today's Appts</div>
            <div className="text-[20px] font-bold text-foreground leading-tight mt-0.5">{todayAppts.length}</div>
            {flaggedCount > 0 && (
              <div className="text-[10px] text-amber-600">{flaggedCount} flagged</div>
            )}
          </div>
          {/* Current lead */}
          <div className="p-3">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Current Lead</div>
            {liveLead ? (
              <>
                <div className="text-[14px] font-bold text-amber-600 leading-tight mt-0.5 truncate">
                  {liveLead.city ?? "Unknown"}
                </div>
                {leadStatus && (
                  <div className="text-[10px] text-muted-foreground truncate">{leadStatus}</div>
                )}
              </>
            ) : (
              <div className="text-[13px] text-muted-foreground mt-0.5">—</div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">

          {/* Zip checker */}
          <ZipCheckerRail config={config} excludedZips={excludedZips} clientCity={clientCity} />

          {/* Layer toggles */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Map Layers</div>
            <div className="space-y-1.5">
              {([
                ["serviceBoundary", "Service boundary"],
                ["excludedAreas",   `Excluded areas${excludedAreas.length > 0 ? ` ${excludedAreas.length}` : ""}`],
                ["todayAppts",      `Today's appointments${todayAppts.length > 0 ? ` ${todayAppts.length}` : ""}`],
                ["currentLead",     "Current lead"],
              ] as [keyof LayerToggles, string][]).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[12px] text-foreground">{label}</span>
                  <button
                    type="button"
                    onClick={() => toggleLayer(key)}
                    className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${
                      layers[key] ? "bg-foreground" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                      layers[key] ? "translate-x-3.5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Excluded areas list */}
          {excludedAreas.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Excluded Areas</div>
              <div className="space-y-1.5">
                {excludedAreas.map(area => (
                  <div key={area.id} className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3.5 w-3.5 rounded border border-red-300 bg-red-50 shrink-0" />
                      <span className="text-[12px] text-foreground">{area.label}</span>
                    </div>
                    {area.zips?.length ? (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {area.zips[0]} {area.zips.length > 1 ? `+${area.zips.length - 1}` : ""}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's appointments list */}
          {todayAppts.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Today's Appts</div>
              <div className="space-y-2">
                {todayAppts.map(appt => (
                  <div key={appt.id} className="flex items-start gap-2">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5 ${
                      appt.flagged ? "bg-amber-500" : "bg-blue-500"
                    }`}>
                      {appt.number}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] font-medium text-foreground truncate">{appt.name}</div>
                      <div className={`text-[11px] leading-tight truncate ${appt.flagged ? "text-amber-600" : "text-muted-foreground"}`}>
                        {appt.city} · {appt.serviceLabel}
                        {appt.flagged && appt.flagNote ? ` — ${appt.flagNote}` : ""}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{appt.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="rounded-md border border-border p-2.5">
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Legend</div>
            <div className="space-y-1.5">
              {[
                { color: "bg-green-200 border-green-400",  label: "Service area" },
                { color: "bg-red-100 border-red-400 border-dashed", label: "Excluded" },
                { color: "bg-blue-500",   label: "Appointment" },
                { color: "bg-orange-400", label: "Live lead" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded border shrink-0 ${color}`} />
                  <span className="text-[11px] text-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAP CANVAS ───────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden bg-muted/30">
        {tokenLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !token ? (
          <div className="h-full flex items-center justify-center text-center px-8">
            <div>
              <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <div className="text-[13px] font-medium text-foreground">Map token not configured</div>
              <div className="text-[12px] text-muted-foreground mt-1">Add MAPBOX_PUBLIC_TOKEN to Supabase edge function secrets</div>
            </div>
          </div>
        ) : !hasHq ? (
          <div className="h-full flex items-center justify-center text-center px-8">
            <div>
              <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <div className="text-[13px] font-medium text-foreground">HQ location not set</div>
              <div className="text-[12px] text-muted-foreground mt-1">Set the HQ address in Edit Client → Service Area</div>
            </div>
          </div>
        ) : (
          <MapCanvas
            token={token}
            hqLat={hqLat!}
            hqLng={hqLng!}
            serviceRadiusMiles={serviceRadiusMiles}
            excludedAreas={excludedAreas}
            liveLead={layers.currentLead ? liveLead : null}
            todayAppts={layers.todayAppts ? todayAppts : []}
            layers={layers}
            onLeadClick={() => setLeadPopupOpen(true)}
            onApptClick={setSelectedAppt}
          />
        )}

        {/* Live lead popup */}
        {leadPopupOpen && liveLead && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="pointer-events-auto bg-background rounded-xl shadow-2xl border border-border p-4 w-64">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-full bg-orange-400 flex items-center justify-center text-white font-bold text-[13px]">L</div>
                <div>
                  <div className="text-[13px] font-semibold">Current lead</div>
                  {liveLead.number && liveLead.callDurationSecs != null && (
                    <div className="text-[11px] text-muted-foreground">
                      {liveLead.number} · Live call {fmtDuration(liveLead.callDurationSecs)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setLeadPopupOpen(false)}
                  className="ml-auto p-1 rounded-md hover:bg-muted text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1.5 text-[12px]">
                {liveLead.address && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Address</span>
                    <span className="font-medium">{liveLead.address}</span>
                  </div>
                )}
                {liveLead.city && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">City</span>
                    <span className="font-medium">{liveLead.city}</span>
                  </div>
                )}
                {config && liveLead && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distance to HQ</span>
                    <span className="font-medium">
                      {Math.round(
                        (() => {
                          const R = 3958.8;
                          const dLat = ((liveLead.lat - config.hq_lat) * Math.PI) / 180;
                          const dLng = ((liveLead.lng - config.hq_lng) * Math.PI) / 180;
                          const a = Math.sin(dLat/2)**2 + Math.cos(config.hq_lat*Math.PI/180)*Math.cos(liveLead.lat*Math.PI/180)*Math.sin(dLng/2)**2;
                          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                        })()
                      )} mi
                    </span>
                  </div>
                )}
              </div>
              {leadStatus === "in excluded zone" && (
                <div className="mt-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-[11px] font-medium text-center py-1.5">
                  ✕ In excluded area — do not book
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-7 text-[12px]" onClick={() => setLeadPopupOpen(false)}>
                  Mark DQ
                </Button>
                <Button size="sm" className="flex-1 h-7 text-[12px]" onClick={() => setLeadPopupOpen(false)}>
                  DQ script
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Appointment popup */}
        {selectedAppt && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="pointer-events-auto bg-background rounded-xl shadow-2xl border border-border p-4 w-60">
              <div className="flex items-center gap-2 mb-3">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-white font-bold text-[12px] ${
                  selectedAppt.flagged ? "bg-amber-500" : "bg-blue-500"
                }`}>
                  {selectedAppt.number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">{selectedAppt.name}</div>
                  <div className="text-[11px] text-muted-foreground">{selectedAppt.city} · {selectedAppt.time}</div>
                </div>
                <button onClick={() => setSelectedAppt(null)} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="text-[12px] text-muted-foreground">{selectedAppt.serviceLabel}</div>
              {selectedAppt.flagged && selectedAppt.flagNote && (
                <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[11px] p-2">
                  ⚑ {selectedAppt.flagNote}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
