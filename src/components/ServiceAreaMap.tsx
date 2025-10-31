import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

interface ServiceAreaMapProps {
  city?: string;
  serviceArea?: string;
  address?: string;
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
const extractRadius = (serviceArea?: string): number => {
  if (!serviceArea) return 30;
  
  // Try to find patterns like "30 miles", "50 mile radius", "25mi", etc.
  const match = serviceArea.match(/(\d+)\s*(mile|mi|km|kilometer)/i);
  if (match) {
    const distance = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    return unit.startsWith('km') ? distance * 0.621371 : distance;
  }
  
  return 30; // Default 30 miles if no radius found
};

export default function ServiceAreaMap({ city, serviceArea, address }: ServiceAreaMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [searchAddress, setSearchAddress] = useState('');
  const [centerCoordinates, setCenterCoordinates] = useState<[number, number] | null>(null);
  const [serviceRadius, setServiceRadius] = useState(30);
  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null);

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

    const searchLocation = address || city || serviceArea || 'United States';
    const radius = extractRadius(serviceArea);
    setServiceRadius(radius);
    
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchLocation)}.json?access_token=${mapboxToken}`)
      .then(res => res.json())
      .then(data => {
        const coordinates = data.features?.[0]?.center || [-98.5795, 39.8283];
        setCenterCoordinates(coordinates as [number, number]);
        
        // Calculate appropriate zoom based on radius
        const zoom = Math.max(8, Math.min(12, 13 - Math.log2(radius / 10)));
        
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: coordinates,
          zoom: zoom,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Add a marker for the center location
        new mapboxgl.Marker({ color: 'hsl(var(--primary))' })
          .setLngLat(coordinates)
          .setPopup(new mapboxgl.Popup().setHTML('<div class="font-semibold">Service Center</div>'))
          .addTo(map.current);

        // Add service area circle
        map.current.on('load', () => {
          if (map.current) {
            const circleGeoJSON = createCircleGeoJSON(coordinates as [number, number], radius);
            
            map.current.addSource('service-area', {
              type: 'geojson',
              data: circleGeoJSON,
            });

            // Fill layer with themed colors
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

            // Add distance markers at cardinal directions
            const distanceX = radius / (69 * Math.cos((coordinates[1] * Math.PI) / 180));
            const distanceY = radius / 69;
            
            const directions = [
              { angle: 0, label: 'E' },      // East
              { angle: Math.PI / 2, label: 'N' },  // North
              { angle: Math.PI, label: 'W' },      // West
              { angle: 3 * Math.PI / 2, label: 'S' } // South
            ];

            directions.forEach(({ angle, label }) => {
              const x = distanceX * Math.cos(angle);
              const y = distanceY * Math.sin(angle);
              const markerCoords: [number, number] = [coordinates[0] + x, coordinates[1] + y];
              
              // Create a custom element for the distance marker
              const el = document.createElement('div');
              el.className = 'distance-marker';
              el.style.cssText = `
                background: hsl(var(--primary));
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                white-space: nowrap;
              `;
              el.textContent = `${radius} mi ${label}`;
              
              new mapboxgl.Marker({ element: el })
                .setLngLat(markerCoords)
                .addTo(map.current!);
            });
          }
        });
      });

    return () => {
      searchMarkerRef.current?.remove();
      map.current?.remove();
    };
  }, [mapboxToken, city, serviceArea, address]);

  const handleAddressSearch = async () => {
    if (!searchAddress.trim() || !mapboxToken || !centerCoordinates) {
      toast.error('Please enter an address to search');
      return;
    }

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchAddress)}.json?access_token=${mapboxToken}`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const searchCoords = data.features[0].center as [number, number];
        
        // Calculate distance between center and searched address
        const R = 3959; // Earth's radius in miles
        const lat1 = centerCoordinates[1] * Math.PI / 180;
        const lat2 = searchCoords[1] * Math.PI / 180;
        const dLat = (searchCoords[1] - centerCoordinates[1]) * Math.PI / 180;
        const dLon = (searchCoords[0] - centerCoordinates[0]) * Math.PI / 180;
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        const isWithinRadius = distance <= serviceRadius;
        
        // Remove previous search marker if exists
        searchMarkerRef.current?.remove();
        
        // Add new marker with appropriate color
        const markerColor = isWithinRadius ? '#22c55e' : '#ef4444';
        searchMarkerRef.current = new mapboxgl.Marker({ color: markerColor })
          .setLngLat(searchCoords)
          .setPopup(
            new mapboxgl.Popup().setHTML(
              `<div class="p-2">
                <p class="font-semibold">${data.features[0].place_name}</p>
                <p class="text-sm mt-1">${distance.toFixed(1)} miles from center</p>
                <p class="text-sm font-semibold ${isWithinRadius ? 'text-green-600' : 'text-red-600'}">
                  ${isWithinRadius ? '✓ Within service area' : '✗ Outside service area'}
                </p>
              </div>`
            )
          )
          .addTo(map.current!);
        
        // Fly to the searched location
        map.current?.flyTo({
          center: searchCoords,
          zoom: 12,
          duration: 1500
        });
        
        // Open popup
        searchMarkerRef.current.togglePopup();
        
        toast.success(
          isWithinRadius 
            ? `Address is within service area (${distance.toFixed(1)} miles)`
            : `Address is outside service area (${distance.toFixed(1)} miles from center)`
        );
      } else {
        toast.error('Address not found');
      }
    } catch (error) {
      console.error('Error searching address:', error);
      toast.error('Failed to search address');
    }
  };

  if (!mapboxToken) {
    return (
      <div className="w-full h-[400px] rounded-lg bg-muted animate-pulse flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Enter address to check if within service area..."
          value={searchAddress}
          onChange={(e) => setSearchAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
        />
        <Button onClick={handleAddressSearch} size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative w-full h-[400px] rounded-lg overflow-hidden border border-border shadow-lg">
        <div ref={mapContainer} className="absolute inset-0" />
      </div>
    </div>
  );
}
