// Area lookup: given a zip or city string + client config, returns qualification status.
// Used by the ScriptViewer Area tab zip-checker rail.

export type AreaStatus = "ok" | "excluded" | "outside" | "unknown";

export interface ExcludedArea {
  id: string;
  label: string;           // e.g. "Renton, WA"
  type: "city" | "county" | "zip";
  mapbox_id: string;
  bbox: [number, number, number, number]; // [west, south, east, north]
  center: [number, number]; // [lng, lat]
  zips?: string[];
}

export interface ClientAreaConfig {
  hq_lat: number;
  hq_lng: number;
  hq_address: string;
  service_radius_miles: number;
  excluded_areas: ExcludedArea[];
}

export interface AreaLookupResult {
  status: AreaStatus;
  distance_miles?: number;
  area?: ExcludedArea;     // populated when status === "excluded"
  label?: string;          // resolved display label from geocoder
  coords?: [number, number]; // [lng, lat] of the resolved location
}

// Haversine distance in miles between two WGS-84 points
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointInBbox(
  lat: number,
  lng: number,
  [west, south, east, north]: [number, number, number, number]
): boolean {
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

// Resolve a zip code or city string to coordinates via Mapbox Geocoding API.
// Returns null if no result found.
async function geocode(
  input: string,
  mapboxToken: string
): Promise<{ lng: number; lat: number; label: string } | null> {
  const q = encodeURIComponent(input.trim());
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${mapboxToken}&limit=1&types=postcode,place,district`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) return null;
  const [lng, lat] = feature.center as [number, number];
  return { lng, lat, label: feature.place_name as string };
}

export async function lookupArea(
  input: string,
  config: ClientAreaConfig,
  mapboxToken: string
): Promise<AreaLookupResult> {
  if (!input.trim()) return { status: "unknown" };

  const resolved = await geocode(input, mapboxToken);
  if (!resolved) return { status: "unknown" };

  const { lng, lat, label } = resolved;
  const coords: [number, number] = [lng, lat];

  // Check excluded areas first (bbox containment)
  for (const area of config.excluded_areas) {
    if (pointInBbox(lat, lng, area.bbox)) {
      const distance_miles = Math.round(
        haversine(config.hq_lat, config.hq_lng, lat, lng)
      );
      return { status: "excluded", distance_miles, area, label, coords };
    }
    // Also check zip list match for zip-type areas
    if (area.type === "zip" && area.zips?.length) {
      const inputZip = input.trim().replace(/\D/g, "").slice(0, 5);
      if (area.zips.includes(inputZip)) {
        const distance_miles = Math.round(
          haversine(config.hq_lat, config.hq_lng, lat, lng)
        );
        return { status: "excluded", distance_miles, area, label, coords };
      }
    }
  }

  // Check service radius
  const distance_miles = Math.round(
    haversine(config.hq_lat, config.hq_lng, lat, lng)
  );
  if (distance_miles > config.service_radius_miles) {
    return { status: "outside", distance_miles, label, coords };
  }

  return { status: "ok", distance_miles, label, coords };
}
