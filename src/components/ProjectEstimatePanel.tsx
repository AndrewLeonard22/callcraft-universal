import { useState } from "react";
import { AlertTriangle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ServiceUnit = "flat" | "sqft" | "linft" | "tier";

interface ServiceTier { label: string; low: number; high: number; }
interface EstimateService {
  id: string; label: string; unit: ServiceUnit;
  priceLow?: number; priceHigh?: number;
  flatLow?: number; flatHigh?: number;
  tiers?: ServiceTier[];
}

const ALL_SERVICES: EstimateService[] = [
  { id: "pergola", label: "Pergola", unit: "tier", tiers: [
    { label: "10×12", low: 10000, high: 16000 },
    { label: "12×16", low: 14000, high: 22000 },
    { label: "14×20", low: 20000, high: 30000 },
    { label: "16×24", low: 28000, high: 42000 },
  ]},
  { id: "pavers",          label: "Pavers",          unit: "sqft",  priceLow: 12,    priceHigh: 22    },
  { id: "turf",            label: "Turf",             unit: "sqft",  priceLow: 8,     priceHigh: 15    },
  { id: "fire_pit",        label: "Fire Pit",         unit: "flat",  flatLow: 3000,   flatHigh: 6000   },
  { id: "outdoor_kitchen", label: "Outdoor Kitchen",  unit: "flat",  flatLow: 15000,  flatHigh: 35000  },
  { id: "pool_deck",       label: "Pool Deck",        unit: "sqft",  priceLow: 20,    priceHigh: 35    },
  { id: "retaining_wall",  label: "Retaining Wall",   unit: "linft", priceLow: 80,    priceHigh: 150   },
  { id: "seating_wall",    label: "Seating Wall",     unit: "linft", priceLow: 60,    priceHigh: 120   },
  { id: "drainage",        label: "Drainage",         unit: "flat",  flatLow: 2000,   flatHigh: 8000   },
];

const BUDGET_BRACKETS = [
  { id: "10-20k", label: "$10–20k", low: 10000,  high: 20000  },
  { id: "20-40k", label: "$20–40k", low: 20000,  high: 40000  },
  { id: "40-60k", label: "$40–60k", low: 40000,  high: 60000  },
  { id: "60k+",   label: "$60k+",   low: 60000,  high: 999999 },
];

interface ServiceState { checked: boolean; qty: string; tier: string; }

interface ProjectEstimatePanelProps {
  clientMinPrice?: number;
  clientServices?: string[];
  salesRepName?: string;
}

const fmtK = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;

export function ProjectEstimatePanel({ clientMinPrice, clientServices, salesRepName }: ProjectEstimatePanelProps) {
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [serviceStates, setServiceStates] = useState<Record<string, ServiceState>>(() =>
    Object.fromEntries(ALL_SERVICES.map(s => [s.id, {
      checked: false,
      qty: "",
      tier: s.tiers?.[1]?.label ?? s.tiers?.[0]?.label ?? "",
    }]))
  );

  const visibleServices = clientServices?.length
    ? ALL_SERVICES.filter(s => clientServices.includes(s.id))
    : ALL_SERVICES;

  const toggle = (id: string) =>
    setServiceStates(prev => ({ ...prev, [id]: { ...prev[id], checked: !prev[id].checked } }));

  const computeRange = () => {
    let low = 0, high = 0, count = 0;
    ALL_SERVICES.forEach(svc => {
      const st = serviceStates[svc.id];
      if (!st?.checked) return;
      count++;
      if (svc.unit === "flat") { low += svc.flatLow!; high += svc.flatHigh!; }
      else if (svc.unit === "tier") {
        const t = svc.tiers!.find(t => t.label === st.tier) ?? svc.tiers![0];
        low += t.low; high += t.high;
      } else {
        const q = parseFloat(st.qty) || 0;
        low += q * svc.priceLow!; high += q * svc.priceHigh!;
      }
    });
    return { low, high, count };
  };

  const { low, high, count } = computeRange();
  const budget = BUDGET_BRACKETS.find(b => b.id === selectedBudget);
  const budgetGap = !!(budget && count > 0 && low > budget.high);
  const belowMin = !!(clientMinPrice && count > 0 && high < clientMinPrice);

  const getPriceLabel = (svc: EstimateService) => {
    const st = serviceStates[svc.id];
    if (svc.unit === "flat") return `${fmtK(svc.flatLow!)} – ${fmtK(svc.flatHigh!)}`;
    if (svc.unit === "tier") {
      const t = svc.tiers!.find(t => t.label === st?.tier) ?? svc.tiers![0];
      return `${fmtK(t.low)} – ${fmtK(t.high)}`;
    }
    const unit = svc.unit === "sqft" ? "/sqft" : "/ft";
    return `$${svc.priceLow}–${svc.priceHigh}${unit}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
        <div className="text-[14px] font-semibold text-foreground">Project Estimate</div>
        <div className="text-[11px] text-muted-foreground">Built from lead's scope</div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-3 space-y-4 pb-2">
          {/* Lead's Stated Budget */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
              Lead's Stated Budget
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BUDGET_BRACKETS.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBudget(selectedBudget === b.id ? null : b.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    selectedBudget === b.id
                      ? "bg-foreground text-background"
                      : "bg-muted text-foreground hover:bg-muted/70"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scope */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
              Scope
            </div>
            <div className="space-y-1">
              {visibleServices.map(svc => {
                const st = serviceStates[svc.id];
                return (
                  <div
                    key={svc.id}
                    onClick={() => toggle(svc.id)}
                    className={`flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                      st.checked
                        ? "bg-primary/5 border border-primary/15"
                        : "hover:bg-muted/40 border border-transparent"
                    }`}
                  >
                    {/* Custom checkbox */}
                    <div className={`mt-0.5 h-3.5 w-3.5 rounded flex items-center justify-center shrink-0 border transition-colors ${
                      st.checked ? "bg-primary border-primary" : "border-border bg-background"
                    }`}>
                      {st.checked && (
                        <svg className="h-2 w-2 text-primary-foreground" fill="none" viewBox="0 0 8 8">
                          <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[12px] font-medium text-foreground">{svc.label}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{getPriceLabel(svc)}</span>
                      </div>

                      {/* Qty input / tier select — inline below name */}
                      {svc.unit !== "flat" && st.checked && (
                        <div onClick={e => e.stopPropagation()} className="mt-1">
                          {svc.unit === "tier" ? (
                            <select
                              value={st.tier}
                              onChange={e => setServiceStates(prev => ({ ...prev, [svc.id]: { ...prev[svc.id], tier: e.target.value } }))}
                              className="text-[10px] text-foreground bg-background border border-border rounded px-1.5 py-0.5 focus:outline-none focus:border-primary"
                            >
                              {svc.tiers!.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
                            </select>
                          ) : (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={st.qty}
                                onChange={e => setServiceStates(prev => ({ ...prev, [svc.id]: { ...prev[svc.id], qty: e.target.value } }))}
                                placeholder="0"
                                className="w-16 text-[11px] bg-background border border-border rounded px-1.5 py-0.5 focus:outline-none focus:border-primary"
                              />
                              <span className="text-[10px] text-muted-foreground">{svc.unit === "sqft" ? "sq ft" : "lin ft"}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer — totals + warnings + save */}
      <div className="shrink-0 border-t border-border p-4 space-y-2.5">
        {/* Estimated range */}
        {count > 0 ? (
          <div className="rounded-lg bg-foreground text-background px-4 py-3">
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] opacity-50 mb-1">Estimated Range</div>
            <div className="text-[20px] font-bold leading-none tracking-tight">
              {fmtK(low)} – {fmtK(high)}
            </div>
            <div className="text-[10px] opacity-50 mt-1.5">
              {count} service{count !== 1 ? "s" : ""} selected
              {clientMinPrice && high >= clientMinPrice && " · ✓ above minimum"}
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-muted px-4 py-3 text-center">
            <div className="text-[12px] text-muted-foreground">Select services to build an estimate</div>
          </div>
        )}

        {/* Budget gap warning */}
        {budgetGap && (
          <div className="flex gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-800 leading-snug">
              <span className="font-semibold">Budget gap. </span>
              Lead said {budget!.label} but scope is {fmtK(low)}–{fmtK(high)}.{" "}
              <em>"Based on what you're describing, most projects like this run {fmtK(low)}–{fmtK(high)} — want {salesRepName || "the team"} to walk you through the numbers?"</em>
            </div>
          </div>
        )}

        {/* Below minimum DQ */}
        {belowMin && (
          <div className="flex gap-2 p-2.5 rounded-md bg-red-50 border border-red-200">
            <Ban className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-red-800 leading-snug">
              <span className="font-semibold">Below minimum. </span>
              Estimate {fmtK(low)}–{fmtK(high)} is under the {fmtK(clientMinPrice!)} minimum. Do not set appointment.
            </div>
          </div>
        )}

        <Button
          onClick={() => toast.success("Estimate saved to lead")}
          disabled={count === 0}
          className="w-full h-9 text-[13px]"
        >
          Save Estimate to Lead
        </Button>
      </div>
    </div>
  );
}
