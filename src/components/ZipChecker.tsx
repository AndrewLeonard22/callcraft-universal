import { useState, useRef } from "react";
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

export function ZipChecker({
  excludedZips,
  clientCity,
  clientAddress,
  serviceRadiusMiles = 30,
}: ZipCheckerProps) {
  const [input, setInput] = useState("");
  const [state, setState] = useState<CheckState>({ status: "idle" });
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

    // Normalize: if pure digits, treat as zip; otherwise city name
    const isZip = /^\d{5}(-\d{4})?$/.test(query);

    // Sync excluded_zips check first (no API needed)
    if (isZip && excludedZips.includes(query)) {
      setState({ status: "excluded", location: query });
      return;
    }

    // If no Mapbox token available, just report excluded/not-excluded for zips
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

    try {
      // Geocode the lead's location
      const leadRes = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}`
      );
      const leadData = await leadRes.json();
      const leadCoords = leadData.features?.[0]?.center as [number, number] | undefined;
      const locationName: string =
        leadData.features?.[0]?.place_name?.split(",")[0] ?? query;

      if (!leadCoords) {
        setState({ status: "error", message: `Could not find "${query}". Try a zip code.` });
        return;
      }

      // Re-check excluded_zips against the resolved place name (city match)
      const normalizedName = locationName.toLowerCase();
      const cityExcluded = excludedZips.some(
        (z) => z.toLowerCase() === normalizedName || normalizedName.includes(z.toLowerCase())
      );
      if (cityExcluded) {
        setState({ status: "excluded", location: locationName });
        return;
      }

      // Geocode the client's center
      const center = clientAddress || clientCity;
      if (!center) {
        setState({ status: "in_range", location: locationName, distanceMiles: 0 });
        return;
      }

      const centerRes = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(center)}.json?access_token=${token}`
      );
      const centerData = await centerRes.json();
      const centerCoords = centerData.features?.[0]?.center as [number, number] | undefined;

      if (!centerCoords) {
        setState({ status: "in_range", location: locationName, distanceMiles: 0 });
        return;
      }

      const distanceMiles = Math.round(haversineDistance(centerCoords, leadCoords));
      const inRange = distanceMiles <= serviceRadiusMiles;

      setState({
        status: inRange ? "in_range" : "out_of_range",
        location: locationName,
        distanceMiles,
      });
    } catch (e) {
      logger.error("ZipChecker error", e);
      setState({ status: "error", message: "Check failed. Try again." });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setState({ status: "idle" });
          }}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="Zip or city..."
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
    </div>
  );
}
