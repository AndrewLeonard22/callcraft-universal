import { useEffect, useRef, useState } from "react";
import { Ban, CheckCircle, AlertTriangle, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { logger } from "@/utils/logger";
import { geocodeOne } from "@/utils/areaLookup";
import { importLibrary, MAP_ID } from "@/map/loader";

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

// Live satellite preview of the resolved location — a real Maps JS map, so
// the mouse wheel zooms (the old keyless <iframe> embed swallowed the wheel;
// Andrew: "you can't scroll to zoom on the Preview in the Script section").
// Falls back to the keyless embed only if the JS API fails to load.
function MiniMap({ center }: { center: [number, number] }) {
  const [lng, lat] = center;
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
          importLibrary<google.maps.MapsLibrary>("maps"),
          importLibrary<google.maps.MarkerLibrary>("marker"),
        ]);
        if (cancelled || !host.current) return;
        if (!mapRef.current) {
          mapRef.current = new Map(host.current, {
            center: { lat, lng },
            zoom: 18, // rooftop scale — the setter needs to SEE the yard
            mapId: MAP_ID,
            mapTypeId: "hybrid",
            gestureHandling: "greedy", // plain mouse wheel zooms, no ctrl needed
            disableDefaultUI: true,
            zoomControl: true,
          });
        } else {
          mapRef.current.setCenter({ lat, lng });
        }
        if (markerRef.current) markerRef.current.map = null;
        markerRef.current = new AdvancedMarkerElement({ map: mapRef.current, position: { lat, lng } });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [lat, lng]);

  return (
    <div className="mt-2.5 rounded-lg overflow-hidden border border-border shadow-sm">
      {failed ? (
        <iframe
          title="Location satellite view"
          src={`https://maps.google.com/maps?q=${lat},${lng}&t=k&z=18&output=embed`}
          className="h-[240px] w-full border-0 block"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div ref={host} className="h-[240px] w-full" />
      )}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-card">
        <a
          href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`}
          target="_blank" rel="noopener noreferrer"
          className="text-[11px] font-medium text-primary hover:underline"
        >Street View</a>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
          target="_blank" rel="noopener noreferrer"
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >Open in Google Maps</a>
      </div>
    </div>
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

  const check = async () => {
    const query = input.trim();
    if (!query) return;

    const isZip = /^\d{5}(-\d{4})?$/.test(query);

    if (isZip && excludedZips.includes(query)) {
      setState({ status: "excluded", location: query });
      setLeadCoords(null);
      return;
    }

    setState({ status: "checking" });
    setLeadCoords(null);

    try {
      const lead = await geocodeOne(query);
      if (!lead) {
        setState({ status: "error", message: `Could not find "${query}". Try a zip code.` });
        return;
      }
      const leadCenter: [number, number] = [lead.lng, lead.lat];
      const locationName: string = lead.label?.split(",")[0] ?? query;

      const normalizedName = locationName.toLowerCase();
      const cityExcluded = excludedZips.some(
        (z) => z.toLowerCase() === normalizedName || normalizedName.includes(z.toLowerCase())
      );
      if (cityExcluded) {
        setState({ status: "excluded", location: locationName });
        setLeadCoords(leadCenter);
        return;
      }

      // Resolve HQ coords — from props, else geocode the client's address/city.
      let hqCenter: [number, number] | null =
        hqLat != null && hqLng != null ? [hqLng, hqLat] : null;

      if (!hqCenter) {
        const centerQuery = clientAddress || clientCity;
        if (centerQuery) {
          const hq = await geocodeOne(centerQuery);
          if (hq) hqCenter = [hq.lng, hq.lat];
        }
      }

      if (!hqCenter) {
        // No HQ to measure from — still show the location, just no distance.
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

  // Prefer the checked location; fall back to HQ so there's always something to show.
  const mapCenter = leadCoords ?? resolvedHqCoords;

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

      {mapCenter && <MiniMap center={mapCenter} />}
    </div>
  );
}
