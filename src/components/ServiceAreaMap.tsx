import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';

interface ServiceAreaMapProps {
  city?: string;
  serviceArea?: string;
}

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

    // Geocode the city to get coordinates
    const searchLocation = city || serviceArea || 'United States';
    
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchLocation)}.json?access_token=${mapboxToken}`)
      .then(res => res.json())
      .then(data => {
        const coordinates = data.features?.[0]?.center || [-98.5795, 39.8283]; // Default to US center
        
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/light-v11',
          center: coordinates,
          zoom: city ? 10 : 6,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Add a marker for the location
        new mapboxgl.Marker({ color: 'hsl(var(--primary))' })
          .setLngLat(coordinates)
          .addTo(map.current);

        // Add service area circle if available
        map.current.on('load', () => {
          if (map.current && serviceArea) {
            map.current.addSource('service-area', {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: coordinates,
                },
                properties: {},
              },
            });

            map.current.addLayer({
              id: 'service-area-circle',
              type: 'circle',
              source: 'service-area',
              paint: {
                'circle-radius': {
                  stops: [
                    [0, 0],
                    [20, 50000],
                  ],
                  base: 2,
                },
                'circle-color': 'hsl(var(--primary))',
                'circle-opacity': 0.15,
                'circle-stroke-width': 2,
                'circle-stroke-color': 'hsl(var(--primary))',
                'circle-stroke-opacity': 0.5,
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
