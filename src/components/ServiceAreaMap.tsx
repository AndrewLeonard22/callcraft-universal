import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Satellite } from 'lucide-react';

interface ServiceAreaMapProps {
  city?: string;
  serviceArea?: string;
  address?: string;
  radiusMiles?: number;
}

// Pull a mileage figure out of free-text like "30 mile radius" / "25mi" / "40 km".
const extractRadius = (serviceArea?: string): number | null => {
  if (!serviceArea) return null;
  const m = serviceArea.match(/(\d+)\s*(mile|mi|km|kilometer)/i);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  return m[2].toLowerCase().startsWith('km') ? Math.round(d * 0.621371) : d;
};

/**
 * Service-area satellite view.
 *
 * REPLACES the old 451-line Mapbox component that couldn't render without a Mapbox
 * token fetched from a Supabase edge function — dead token = dead map. This is a
 * KEYLESS Google satellite embed (t=k = satellite imagery): zero secrets, zero build
 * config, zero backend round-trip. Type an address → see the actual rooftop from above.
 *
 * Upgrade path (flagged): photoreal 3D / Google-Earth tilt needs the paid Maps Embed
 * API (a billing-enabled key). Drop the key in and swap src to the Embed API view mode;
 * the component's props contract doesn't change.
 */
export default function ServiceAreaMap({ city, serviceArea, address, radiusMiles }: ServiceAreaMapProps) {
  const initial = [address, city].filter(Boolean).join(', ').trim();
  const [query, setQuery] = useState(initial);
  const [active, setActive] = useState(initial);
  const radius = radiusMiles ?? extractRadius(serviceArea);

  const src = useMemo(() => {
    const q = (active || city || 'United States').trim();
    // t=k → satellite; z=18 → rooftop-level; output=embed → no key required.
    return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&t=k&z=18&output=embed`;
  }, [active, city]);

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setActive(query.trim());
        }}
        className="flex gap-2"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search an address for a satellite view…"
          className="flex-1"
          aria-label="Address"
        />
        <Button type="submit" size="icon" aria-label="Show satellite view">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      <div
        className="relative overflow-hidden rounded-lg border bg-muted"
        style={{ aspectRatio: '16 / 10' }}
      >
        <iframe
          key={src}
          title="Service area satellite view"
          src={src}
          className="absolute inset-0 h-full w-full"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Satellite className="h-3.5 w-3.5" />
          Satellite{active ? ` · ${active}` : ''}
        </span>
        {radius ? <span>Service radius: ~{radius} mi</span> : null}
      </div>
    </div>
  );
}
