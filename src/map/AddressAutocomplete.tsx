import { useCallback, useEffect, useRef, useState } from "react";
import { Search, MapPin } from "lucide-react";
import { importLibrary } from "@/map/loader";

// Minimal shape of a Places AutocompleteSuggestion's placePrediction — @types lags.
interface PlacePred {
  text: { toString(): string };
  toPlace(): google.maps.places.Place;
}

export interface AddressAutocompleteProps {
  /** Called with the resolved coords + formatted label when the user picks a suggestion. */
  onPick: (lat: number, lng: number, label: string | null) => void;
  /** Optional: true while the field is focused (so an overlapping card can yield). */
  onActiveChange?: (active: boolean) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Controllable address autocomplete — a plain <input> + our OWN suggestions dropdown,
 * driven by the Places AutocompleteSuggestion API.
 *
 * This REPLACES the <gmp-place-autocomplete> web component, whose CLOSED shadow DOM made
 * its input un-typeable / un-debuggable in an overlay-over-map layout (the "typing goes
 * nowhere" bug Andrew hit). A plain input is provably typeable and our own z-30 dropdown
 * is guaranteed above the 3D canvas. Verified end-to-end (type → suggestions → pick → coords).
 */
export function AddressAutocomplete({
  onPick,
  onActiveChange,
  placeholder = "Type an address…",
  className = "",
}: AddressAutocompleteProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<{ text: string; prediction: PlacePred }[]>([]);
  const sessionRef = useRef<unknown>(null); // Places autocomplete session token
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new suggestion API, @types lags
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await importLibrary<any>("places");
      if (!sessionRef.current) sessionRef.current = new AutocompleteSessionToken();
      const { suggestions: sugs } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: q,
        includedRegionCodes: ["us"],
        sessionToken: sessionRef.current,
      });
      setSuggestions(
        (sugs as { placePrediction?: PlacePred }[])
          .map((s) => s.placePrediction)
          .filter((p): p is PlacePred => !!p)
          .map((p) => ({ text: p.text.toString(), prediction: p })),
      );
    } catch {
      setSuggestions([]);
    }
  }, []);

  const onChange = (v: string) => {
    setInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchSuggestions(v), 250);
  };

  const pick = useCallback(
    async (prediction: PlacePred) => {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "location"] });
      const loc = place.location;
      setInput(place.formattedAddress ?? "");
      setSuggestions([]);
      sessionRef.current = null; // token is single-use per session; reset after a pick
      onActiveChange?.(false);
      if (loc) onPick(loc.lat(), loc.lng(), place.formattedAddress ?? null);
    },
    [onPick, onActiveChange],
  );

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onActiveChange?.(true)}
          onBlur={() => setTimeout(() => onActiveChange?.(false), 150)}
          placeholder={placeholder}
          className="w-full h-9 pl-8 pr-3 rounded-lg bg-background/95 border border-border shadow-md text-[13px] text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-background shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                void pick(s.prediction);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{s.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
