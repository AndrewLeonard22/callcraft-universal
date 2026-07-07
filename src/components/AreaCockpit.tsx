import { useCallback, useState } from "react";
import { Loader2, Navigation, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAreaMap, type AreaMode } from "@/map/useAreaMap";
import { fmtK, fmtMiles } from "@/map/qualify";

// The Area cockpit — first-principles rebuild (docs/AREA-REBUILD.md).
// The engine (useAreaMap) owns Google; this component is overlays only.
// Zones: top-left = search + qualification · top-right = modes + measure ·
// bottom-right = ✨ visualize · bottom-center = measure readout.

const GLASS = "rounded-xl border border-border bg-background/95 shadow-lg backdrop-blur";

export interface AreaCockpitProps {
  hqAddress?: string;
  hqLat?: number | null;
  hqLng?: number | null;
  serviceRadiusMiles?: number;
}

export function AreaCockpit({ hqAddress, hqLat, hqLng, serviceRadiusMiles }: AreaCockpitProps) {
  const m = useAreaMap({ hqAddress, hqLat, hqLng, serviceRadiusMiles });

  const [vizOpen, setVizOpen] = useState(false);
  const [vizPrompt, setVizPrompt] = useState("");
  const [vizBusy, setVizBusy] = useState(false);
  const [vizError, setVizError] = useState<string | null>(null);
  const [vizResult, setVizResult] = useState<{ before: string; after: string } | null>(null);
  const [showBefore, setShowBefore] = useState(false);

  const runVisualize = useCallback(async () => {
    if (!m.focus || !vizPrompt.trim() || vizBusy) return;
    setVizBusy(true);
    setVizError(null);
    try {
      const r = await fetch("/api/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: m.focus.lat, lng: m.focus.lng, prompt: vizPrompt.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setVizResult({ before: d.before, after: d.after });
    } catch (e) {
      setVizError(String(e instanceof Error ? e.message : e).slice(0, 140));
    } finally {
      setVizBusy(false);
    }
  }, [m.focus, vizPrompt, vizBusy]);

  const modeBtn = (id: AreaMode, label: string, disabled = false) => (
    <Button
      key={id}
      size="sm"
      variant={m.mode === id ? "default" : "outline"}
      className="h-7 gap-1 px-2.5 text-[11px] shadow-md"
      disabled={disabled}
      onClick={() => void m.setMode(id)}
    >
      {label}
    </Button>
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-muted/30">
      {/* layers — the engine decides which is visible */}
      <div ref={m.hosts.mapHost} className="h-full w-full" />
      <div ref={m.hosts.threeHost} className={`absolute inset-0 ${m.mode === "3d" ? "" : "hidden"}`} />
      <div ref={m.hosts.streetHost} className={`absolute inset-0 ${m.mode === "street" ? "" : "hidden"}`} />

      {!m.ready && !m.failReason && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {m.failReason && (
        <div className="absolute left-3 top-3 z-30 max-w-[540px] rounded-lg border border-red-300 bg-red-50/95 px-3 py-2 text-[12px] font-medium text-red-800 shadow-lg backdrop-blur">
          ⚠️ {m.failReason}
        </div>
      )}

      {/* top-left: search + the qualification card */}
      <div className="absolute left-3 top-3 z-10 w-[340px] max-w-[80%] space-y-1.5">
        <div ref={m.hosts.searchHost} className={`${GLASS} [&_gmp-place-autocomplete]:w-full`} />
        {m.focus && m.mode !== "street" && (
          <div
            className={`space-y-1 px-3.5 py-2.5 text-[12px] font-medium ${GLASS} ${
              m.verdict ? (m.verdict.inRange ? "border-green-300 bg-green-50/95" : "border-red-300 bg-red-50/95") : ""
            }`}
          >
            <div className="truncate text-[12.5px] font-semibold text-foreground">📍 {m.focus.label ?? "Pinned location"}</div>
            {m.verdict && (
              <div className={`text-[13.5px] font-bold ${m.verdict.inRange ? "text-green-700" : "text-red-700"}`}>
                {m.verdict.inRange ? "✓ IN SERVICE AREA" : "✗ OUTSIDE SERVICE AREA"}
                <span className="font-medium text-muted-foreground">
                  {" "}· {fmtMiles(m.verdict.miles)} mi{serviceRadiusMiles ? ` of ${serviceRadiusMiles}` : ""}
                </span>
              </div>
            )}
            {m.route && (
              <div className="flex items-center gap-1.5 text-[12.5px] text-foreground">
                <Navigation className="h-3.5 w-3.5 shrink-0 text-red-500" />
                {m.route.miles.toFixed(1)} mi drive · {Math.round(m.route.mins)} min
              </div>
            )}
            {m.homeValue && (
              <div className="text-[14px] font-bold text-foreground">
                🏠 ~{fmtK(m.homeValue.value)} est. value
                {m.homeValue.low && m.homeValue.high && (
                  <span className="text-[11.5px] font-medium text-muted-foreground">
                    {" "}({fmtK(m.homeValue.low)}–{fmtK(m.homeValue.high)})
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* top-right: modes + measure */}
      <div className="absolute right-3 top-3 z-10 flex flex-wrap justify-end gap-1.5">
        {modeBtn("map", "Map")}
        {modeBtn("3d", "3D", !m.threeDAvailable)}
        {modeBtn("street", "Street")}
        <Button
          size="sm"
          variant={m.measuring ? "default" : "outline"}
          className="h-7 gap-1 px-2.5 text-[11px] shadow-md"
          onClick={() => void m.toggleMeasure()}
        >
          <Ruler className="h-3.5 w-3.5" />
          Measure
        </Button>
      </div>

      {/* bottom-center: measure readout */}
      {m.measuring && (
        <div className={`absolute bottom-3 left-1/2 z-10 -translate-x-1/2 px-3 py-1.5 text-[12px] font-semibold ${GLASS}`}>
          {m.areaSqFt != null ? <>📐 {Math.round(m.areaSqFt).toLocaleString()} sq ft · Measure again to reset</> : <>👆 Click each corner of the yard — area tallies as you go</>}
        </div>
      )}

      {/* bottom-right: ✨ visualizer */}
      {m.focus && m.mode !== "street" && (
        <div className="absolute bottom-3 right-3 z-10 w-[300px]">
          {!vizOpen ? (
            <Button size="sm" className="h-8 w-full shadow-lg" onClick={() => setVizOpen(true)}>
              ✨ Visualize the project
            </Button>
          ) : (
            <div className={`space-y-2 p-3 ${GLASS}`}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold">✨ Render the upgrade on this yard</span>
                <button className="text-muted-foreground hover:text-foreground" onClick={() => setVizOpen(false)}>✕</button>
              </div>
              <div className="flex flex-wrap gap-1">
                {["Turf lawn", "Paver patio", "Pergola", "Fire pit", "Pool"].map((c) => (
                  <button
                    key={c}
                    className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] hover:bg-muted"
                    onClick={() => setVizPrompt((p) => (p ? `${p}, ${c.toLowerCase()}` : c))}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <textarea
                value={vizPrompt}
                onChange={(e) => setVizPrompt(e.target.value)}
                placeholder="Describe it — 'turf in the back, pergola over a paver patio'…"
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-primary"
              />
              {vizError && <div className="text-[11px] font-medium text-red-600">{vizError}</div>}
              <Button size="sm" className="h-8 w-full" disabled={vizBusy || !vizPrompt.trim()} onClick={() => void runVisualize()}>
                {vizBusy ? "Rendering the yard…" : "Render it"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* render result — full-bleed compare */}
      {vizResult && (
        <div className="absolute inset-0 z-30 flex flex-col bg-black/85">
          <img src={showBefore ? vizResult.before : vizResult.after} alt="AI render" className="min-h-0 flex-1 object-contain" />
          <div className="flex items-center justify-center gap-2 p-3">
            <Button
              size="sm"
              variant="secondary"
              className="h-8"
              onMouseDown={() => setShowBefore(true)}
              onMouseUp={() => setShowBefore(false)}
              onMouseLeave={() => setShowBefore(false)}
            >
              Hold to compare
            </Button>
            <Button size="sm" variant="secondary" className="h-8" onClick={() => { setVizResult(null); setShowBefore(false); }}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
