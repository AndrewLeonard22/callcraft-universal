// Pure qualification math + formatters. No Google, no React — testable.

export interface Verdict {
  miles: number;
  inRange: boolean;
}

const EARTH_MILES = 3958.8;

export function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return EARTH_MILES * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function qualify(hqLat: number, hqLng: number, lat: number, lng: number, radiusMiles?: number): Verdict {
  const miles = haversineMiles(hqLat, hqLng, lat, lng);
  return { miles, inRange: radiusMiles ? miles <= radiusMiles : true };
}

export const fmtMiles = (m: number): string => (m < 1 ? "<1" : String(Math.round(m)));
export const fmtK = (n: number): string => `$${Math.round(n / 1000)}K`;
