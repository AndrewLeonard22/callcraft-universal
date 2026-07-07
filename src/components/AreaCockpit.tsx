import { Loader2, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAreaMap, type AreaMode } from "@/map/useAreaMap";
import { fmtK, fmtMiles } from "@/map/qualify";

// The Area cockpit — first-principles rebuild (docs/AREA-REBUILD.md).
// The engine (useAreaMap) owns Google; this component is overlays only.
// Zones: top-left = search + qualification · top-right = modes + measure ·
// bottom-center = measure readout.

const GLASS = "rounded-xl border border-border bg-background/95 shadow-lg backdrop-blur";

export interface AreaCockpitProps {
  hqAddress?: string;
  hqLat?: number | null;
  hqLng?: number | null;
  serviceRadiusMiles?: number;
}

const fmtDrive = (mins: number) =>
  mins >= 90 ? `${(mins / 60).toFixed(1)} hr` : `${Math.round(mins)} min`;

export function AreaCockpit({ hqAddress, hqLat, hqLng, serviceRadiusMiles }: AreaCockpitProps) {
  const m = useAreaMap({ hqAddress, hqLat, hqLng, serviceRadiusMiles });

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
      {/* invisible (not hidden) so the pre-warmed Earth keeps streaming tiles */}
      <div ref={m.hosts.threeHost} className={`absolute inset-0 ${m.mode === "3d" ? "" : "invisible pointer-events-none"}`} />
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
        {m.focus && m.mode !== "street" && !m.searchActive && (
          <div className={`px-3.5 py-3 ${GLASS}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 truncate text-[12.5px] font-semibold text-foreground">
                {m.focus.label ?? "Pinned location"}
              </div>
              {m.verdict && (
                <span
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${
                    m.verdict.inRange ? "bg-green-600/10 text-green-700" : "bg-red-600/10 text-red-600"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${m.verdict.inRange ? "bg-green-600" : "bg-red-600"}`} />
                  {m.verdict.inRange ? "In area" : "Out of area"}
                </span>
              )}
            </div>
            {(m.verdict || m.route) && (
              <div className="mt-1 text-[12px] text-muted-foreground">
                {m.verdict && <>{fmtMiles(m.verdict.miles)} mi from HQ{serviceRadiusMiles ? ` · limit ${serviceRadiusMiles}` : ""}</>}
                {m.verdict && m.route && <> · </>}
                {m.route && <>{fmtDrive(m.route.mins)} drive</>}
              </div>
            )}
            {m.homeValue && (
              <div className="mt-2 flex items-baseline gap-2 border-t border-border/60 pt-2">
                <span className="text-[19px] font-bold tracking-tight text-foreground">{fmtK(m.homeValue.value)}</span>
                <span className="text-[11px] text-muted-foreground">
                  est. home value
                  {m.homeValue.low && m.homeValue.high && ` · ${fmtK(m.homeValue.low)}–${fmtK(m.homeValue.high)}`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* top-right: modes + measure */}
      <div className="absolute right-3 top-3 z-10 flex flex-wrap justify-end gap-1.5">
        {modeBtn("map", "Map")}
        <Button
          size="sm"
          variant={m.mode === "3d" ? "default" : "outline"}
          className="h-7 gap-1 px-2.5 text-[11px] shadow-md"
          disabled={!m.threeDAvailable || m.busy3d}
          onClick={() => void m.setMode("3d")}
        >
          {m.busy3d && <Loader2 className="h-3 w-3 animate-spin" />}
          3D
        </Button>
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
          {m.areaSqFt != null ? <>📐 {Math.round(m.areaSqFt).toLocaleString()} sq ft · drag any corner to adjust</> : <>👆 Click each corner of the yard — drag corners to fine-tune</>}
        </div>
      )}
    </div>
  );
}
