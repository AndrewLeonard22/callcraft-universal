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
  radiusMiles?: number;
}

// Convert "221 83% 53%" to hex like #3b82f6 for Mapbox compatibility
const hslTripletToHex = (triplet: string): string => {
  const match = triplet.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
  if (!match) return '#3b82f6';
  let [_, h, s, l] = match;
  const hh = parseFloat(h), ss = parseFloat(s) / 100, ll = parseFloat(l) / 100;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + hh / 30) % 12;
    const c = ll - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

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

export default function ServiceAreaMap({ city, serviceArea, address, radiusMiles }: ServiceAreaMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>("");
  const [tokenError, setTokenError] = useState<boolean>(false);
  const [manualToken, setManualToken] = useState<string>("");
  const [searchAddress, setSearchAddress] = useState("");
  const [centerCoordinates, setCenterCoordinates] = useState<[number, number] | null>(null);
  const [serviceRadius, setServiceRadius] = useState(30);
  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        // 1) Prefer a locally saved token to unblock UI quickly
        const local = localStorage.getItem("MAPBOX_PUBLIC_TOKEN");
        if (local) {
          setMapboxToken(local);
          return;
        }

        // 2) Fetch from backend function (recommended)
        const { data, error } = await supabase.functions.invoke("get-mapbox-token");
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          setTokenError(true);
        }
      } catch (e) {
        setTokenError(true);
      }
    };
    fetchToken();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    const searchLocation = address || city || serviceArea || 'United States';
    const radius = typeof radiusMiles === 'number' && !isNaN(radiusMiles) ? radiusMiles : extractRadius(serviceArea);
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
          style: 'mapbox://styles/mapbox/satellite-streets-v12',
          center: coordinates,
          zoom: zoom,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        
        // Add scale control to show distance
        map.current.addControl(
          new mapboxgl.ScaleControl({
            maxWidth: 100,
            unit: 'imperial'
          }),
          'bottom-right'
        );

        // Add a marker for the center location
        new mapboxgl.Marker({ color: '#ef4444' })
          .setLngLat(coordinates)
          .setPopup(new mapboxgl.Popup().setHTML('<div class="font-semibold">Service Center</div>'))
          .addTo(map.current);

        // Add service area circle
        map.current.on('load', () => {
          if (map.current) {
            const circleGeoJSON = createCircleGeoJSON(coordinates as [number, number], radius);
            
            // Get primary color and convert to hex for Mapbox
            const primaryTriplet = getComputedStyle(document.documentElement)
              .getPropertyValue('--primary')
              .trim();
            const mapboxColor = primaryTriplet ? hslTripletToHex(primaryTriplet) : '#3b82f6';
            
            map.current.addSource('service-area', {
              type: 'geojson',
              data: circleGeoJSON,
            });

            // Fill layer with themed colors (more visible)
            map.current.addLayer({
              id: 'service-area-fill',
              type: 'fill',
              source: 'service-area',
              paint: {
                'fill-color': mapboxColor,
                'fill-opacity': 0.3,
              },
            });

            // Border layer (stronger outline)
            map.current.addLayer({
              id: 'service-area-outline',
              type: 'line',
              source: 'service-area',
              paint: {
                'line-color': mapboxColor,
                'line-width': 4,
                'line-opacity': 0.95,
              },
            });
            
            // Add radius label at the top of the circle
            const labelY = radius / 69;
            const labelCoords: [number, number] = [coordinates[0], coordinates[1] + labelY];
            
            const labelEl = document.createElement('div');
            labelEl.style.cssText = `
              background: white;
              color: #1f2937;
              padding: 8px 16px;
              border-radius: 20px;
              font-size: 13px;
              font-weight: 700;
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
              white-space: nowrap;
              border: 2px solid ${mapboxColor};
            `;
            labelEl.innerHTML = `<div style="text-align: center;"><div style="font-size: 15px; margin-bottom: 2px;">${radius} Miles</div><div style="font-size: 11px; color: #6b7280;">~${Math.round(radius * 1.5)} min drive</div></div>`;
            
            new mapboxgl.Marker({ 
              element: labelEl,
              anchor: 'bottom'
            })
              .setLngLat(labelCoords)
              .addTo(map.current!);
          }
        });
      });

    return () => {
      searchMarkerRef.current?.remove();
      map.current?.remove();
    };
  }, [mapboxToken, city, serviceArea, address, radiusMiles]);

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
      <div className="space-y-3">
        {tokenError && (
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground mb-3">
              Map is unavailable because the Mapbox public token is missing.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Paste Mapbox public token (pk_...)"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
              />
              <Button
                onClick={() => {
                  if (manualToken.trim()) {
                    localStorage.setItem("MAPBOX_PUBLIC_TOKEN", manualToken.trim());
                    setMapboxToken(manualToken.trim());
                  }
                }}
              >
                Use Token
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Tip: Add this permanently in backend secrets as MAPBOX_PUBLIC_TOKEN for all users.
            </p>
          </div>
        )}
        <div className="w-full h-[400px] rounded-lg bg-muted animate-pulse flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
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
