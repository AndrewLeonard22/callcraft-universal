import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logger } from "@/utils/logger";
import type { ExcludedArea } from "@/utils/areaLookup";

// ── Mapbox Geocoding types ──────────────────────────────────────────────────

interface MapboxFeature {
  id: string;
  place_name: string;
  place_type: string[];
  center: [number, number];
  bbox?: [number, number, number, number];
  context?: { id: string; text: string }[];
  text: string;
}

function featureToExcludedArea(f: MapboxFeature): ExcludedArea {
  const type: ExcludedArea["type"] = f.place_type.includes("postcode")
    ? "zip"
    : f.place_type.includes("district")
    ? "county"
    : "city";

  // Build a short label: "Renton, WA" or "98055"
  const stateCtx = f.context?.find(c => c.id.startsWith("region"));
  const label =
    type === "zip"
      ? `${f.text}${stateCtx ? `, ${stateCtx.text}` : ""}`
      : f.place_name.split(",").slice(0, 2).join(",").trim();

  // Fall back to a ~5 mile bbox around center if Mapbox doesn't supply one
  const [lng, lat] = f.center;
  const delta = 0.07; // ~5 miles
  const bbox: [number, number, number, number] = f.bbox ?? [
    lng - delta,
    lat - delta,
    lng + delta,
    lat + delta,
  ];

  return {
    id: f.id,
    label,
    type,
    mapbox_id: f.id,
    bbox,
    center: f.center,
  };
}

// ── Keyless geocoding (OpenStreetMap Nominatim) ─────────────────────────────
// The old Mapbox path fetched a token from a Supabase edge fn that returns
// nothing → every suggestion box was silently empty. This is keyless (matches
// areaLookup.ts). Nominatim hits are adapted to the MapboxFeature shape the rest
// of this file speaks, so featureToExcludedArea / pick / render are untouched.

interface NominatimHit {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string]; // [south, north, west, east]
  type?: string;
  class?: string;
  addresstype?: string;
  name?: string;
  address?: { state?: string; [k: string]: string | undefined };
}

function nominatimToFeature(h: NominatimHit): MapboxFeature {
  const lng = parseFloat(h.lon);
  const lat = parseFloat(h.lat);
  const at = h.addresstype || h.type || "";
  const place_type =
    at === "postcode"
      ? ["postcode"]
      : at === "county" || h.type === "administrative"
        ? ["district"]
        : at === "city" || at === "town" || at === "village"
          ? ["place"]
          : ["address"];
  // Nominatim bbox is [south, north, west, east]; MapboxFeature wants [west, south, east, north].
  const bbox: [number, number, number, number] | undefined = h.boundingbox
    ? [
        parseFloat(h.boundingbox[2]),
        parseFloat(h.boundingbox[0]),
        parseFloat(h.boundingbox[3]),
        parseFloat(h.boundingbox[1]),
      ]
    : undefined;
  // Preserve the region so the zip-label logic in featureToExcludedArea still works.
  const context = h.address?.state ? [{ id: "region.0", text: h.address.state }] : undefined;
  return {
    id: `osm-${h.place_id}`,
    place_name: h.display_name,
    place_type,
    center: [lng, lat],
    bbox,
    context,
    text: h.name || h.display_name.split(",")[0].trim(),
  };
}

async function keylessGeocode(q: string, limit: number): Promise<MapboxFeature[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    q
  )}&format=jsonv2&addressdetails=1&countrycodes=us&limit=${limit}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data: NominatimHit[] = await res.json();
    return data.map(nominatimToFeature);
  } catch (e) {
    logger.error("Keyless geocode failed", e);
    return [];
  }
}

// ── HQ Geocoder ────────────────────────────────────────────────────────────

interface HqGeocoderProps {
  value: string;
  onChange: (address: string, lat: number, lng: number) => void;
}

export function HqGeocoder({ value, onChange }: HqGeocoderProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    const features = await keylessGeocode(q, 5);
    setSuggestions(features);
    setOpen(true);
    setLoading(false);
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const pick = (f: MapboxFeature) => {
    const [lng, lat] = f.center;
    const label = f.place_name.split(",").slice(0, 2).join(",").trim();
    setQuery(label);
    onChange(label, lat, lng);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => handleInput(e.target.value)}
          placeholder="e.g. Bellevue, WA or 123 Main St"
          className="pl-9"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-md overflow-hidden">
          {suggestions.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => pick(f)}
              className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted transition-colors flex items-center gap-2"
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{f.place_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Excluded Area chip input ───────────────────────────────────────────────

const TYPE_BADGE: Record<ExcludedArea["type"], { label: string; cls: string }> = {
  city:   { label: "City",   cls: "bg-blue-100 text-blue-700 border-blue-200" },
  county: { label: "County", cls: "bg-purple-100 text-purple-700 border-purple-200" },
  zip:    { label: "Zip",    cls: "bg-amber-100 text-amber-700 border-amber-200" },
};

interface ExcludedAreaEditorProps {
  value: ExcludedArea[];
  onChange: (areas: ExcludedArea[]) => void;
}

export function ExcludedAreaEditor({ value, onChange }: ExcludedAreaEditorProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    const features = await keylessGeocode(q, 6);
    setSuggestions(features);
    setOpen(true);
    setLoading(false);
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const add = (f: MapboxFeature) => {
    const area = featureToExcludedArea(f);
    if (!value.find(a => a.mapbox_id === area.mapbox_id)) {
      onChange([...value, area]);
    }
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const remove = (id: string) => onChange(value.filter(a => a.id !== id));

  return (
    <div className="space-y-2">
      {/* Chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(area => {
            const badge = TYPE_BADGE[area.type];
            return (
              <span
                key={area.id}
                className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded-full border border-border bg-background text-[12px] font-medium text-foreground"
              >
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
                  {badge.label}
                </span>
                {area.label}
                <button
                  type="button"
                  onClick={() => remove(area.id)}
                  className="ml-0.5 rounded-full hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={e => handleInput(e.target.value)}
          placeholder="Search city, county, or zip to exclude…"
          className="pl-9"
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div className="relative z-50">
          <div className="absolute top-0 w-full rounded-md border border-border bg-background shadow-md overflow-hidden">
            {suggestions.map(f => {
              const area = featureToExcludedArea(f);
              const badge = TYPE_BADGE[area.type];
              const alreadyAdded = !!value.find(a => a.mapbox_id === f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); if (!alreadyAdded) add(f); }}
                  disabled={alreadyAdded}
                  className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-40"
                >
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <span className="truncate flex-1">{f.place_name}</span>
                  {alreadyAdded && <span className="text-[10px] text-muted-foreground shrink-0">added</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Excluded areas show as disqualified in the Area tab during calls.
      </p>
    </div>
  );
}

// ── Combined Area Settings card ────────────────────────────────────────────

export interface AreaSettings {
  hqAddress: string;
  hqLat: number | null;
  hqLng: number | null;
  serviceRadiusMiles: string;
  excludedAreas: ExcludedArea[];
}

interface AreaSettingsEditorProps {
  value: AreaSettings;
  onChange: (v: AreaSettings) => void;
}

export function AreaSettingsEditor({ value, onChange }: AreaSettingsEditorProps) {
  return (
    <div className="space-y-5">
      {/* HQ Location */}
      <div className="space-y-1.5">
        <Label>HQ Location</Label>
        <HqGeocoder
          value={value.hqAddress}
          onChange={(address, lat, lng) =>
            onChange({ ...value, hqAddress: address, hqLat: lat, hqLng: lng })
          }
        />
        {value.hqLat && value.hqLng && (
          <p className="text-[11px] text-muted-foreground">
            {value.hqLat.toFixed(5)}, {value.hqLng.toFixed(5)}
          </p>
        )}
      </div>

      {/* Service radius */}
      <div className="space-y-1.5">
        <Label>Service Radius (miles)</Label>
        <Input
          type="number"
          min={1}
          max={500}
          placeholder="e.g. 45"
          value={value.serviceRadiusMiles}
          onChange={e => onChange({ ...value, serviceRadiusMiles: e.target.value })}
          className="w-32"
        />
      </div>

      {/* Excluded areas */}
      <div className="space-y-1.5">
        <Label>Excluded Areas</Label>
        <ExcludedAreaEditor
          value={value.excludedAreas}
          onChange={areas => onChange({ ...value, excludedAreas: areas })}
        />
      </div>
    </div>
  );
}
