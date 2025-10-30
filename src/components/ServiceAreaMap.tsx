import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';

interface ServiceAreaMapProps {
  city?: string;
  serviceArea?: string;
}

// Helper to create a circle polygon
const createCircleGeoJSON = (center: [number, number], radiusMiles: number) => {
  const points = 64;
  const coords: [number, number][] = [];
  const distanceX = radiusMiles / (69 * Math.cos((center[1] * Math.PI) / 180));
  const distanceY = radiusMiles / 69;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([center[0] + x, center[1] + y]);
  }
  coords.push(coords[0]); // Close the circle

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
    properties: {},
  };
};

// Extract radius from service area text
const extractRadius = (serviceArea: string): number => {
  const match = serviceArea.match(/(\d+)\s*(mile|mi|km|kilometer)/i);
  if (match) {
    const distance = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    return unit.startsWith('km') ? distance * 0.621371 : distance;
  }
  return 30; // Default 30 miles
};

export default function ServiceAreaMap({ city, serviceArea }: ServiceAreaMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');

  useEffect(() => {
    const fetchToken = async () => {
      const { data } = await supabase.functions.invoke('get-mapbox-token');
      if (data?.token) {
        setMapboxToken(data.token);
      }
    };
    fetchToken();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    const searchLocation = city || serviceArea || 'United States';
    const radius = serviceArea ? extractRadius(serviceArea) : 30;
    
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchLocation)}.json?access_token=${mapboxToken}`)
      .then(res => res.json())
      .then(data => {
        const coordinates = data.features?.[0]?.center || [-98.5795, 39.8283];
        
        // Calculate zoom level based on radius
        const zoom = Math.min(Math.max(14 - Math.log2(radius / 5), 8), 13);
        
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/light-v11',
          center: coordinates,
          zoom: zoom,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Add a marker for the center location
        new mapboxgl.Marker({ color: 'hsl(var(--primary))' })
          .setLngLat(coordinates)
          .addTo(map.current);

        // Add service area circle
        map.current.on('load', () => {
          if (map.current) {
            const circleGeoJSON = createCircleGeoJSON(coordinates as [number, number], radius);
            
            map.current.addSource('service-area', {
              type: 'geojson',
              data: circleGeoJSON,
            });

            // Fill layer
            map.current.addLayer({
              id: 'service-area-fill',
              type: 'fill',
              source: 'service-area',
              paint: {
                'fill-color': 'hsl(var(--primary))',
                'fill-opacity': 0.15,
              },
            });

            // Border layer
            map.current.addLayer({
              id: 'service-area-outline',
              type: 'line',
              source: 'service-area',
              paint: {
                'line-color': 'hsl(var(--primary))',
                'line-width': 2,
                'line-opacity': 0.6,
              },
            });
          }
        });
      });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, city, serviceArea]);

  if (!mapboxToken) {
    return (
      <div className="w-full h-[300px] rounded-lg bg-muted animate-pulse flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[300px] rounded-lg overflow-hidden border border-border">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
}
