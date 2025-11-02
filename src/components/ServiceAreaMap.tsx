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
  const [mapError, setMapError] = useState<string | null>(null);
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

    // Ensure previous map instance is cleaned up before re-initializing
    if (map.current) {
      try { map.current.remove(); } catch {}
      map.current = null;
    }

    mapboxgl.accessToken = mapboxToken;

    const handleResize = () => {
      map.current?.resize();
    };

    // Filter out invalid location values and use first valid location
    const candidates = [address, city, serviceArea].filter(
      (loc): loc is string => !!loc && loc.trim() !== '' && !/^n\/?a$/i.test(loc.trim()) && loc.trim().toLowerCase() !== 'n/a' && loc.trim().toLowerCase() !== 'na' && loc.trim().toLowerCase() !== 'none'
    );
    const searchLocation = candidates[0] || 'United States';
    const radius = typeof radiusMiles === 'number' && !isNaN(radiusMiles) ? radiusMiles : extractRadius(serviceArea);
    setServiceRadius(radius);
    
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchLocation)}.json?access_token=${mapboxToken}`)
      .then(res => {
        if (!res.ok) throw new Error('Geocoding failed');
        return res.json();
      })
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
          attributionControl: false,
        });

        console.log('Map instance created, waiting for load event...');

        // Ensure map is visible and properly sized
        map.current.on('load', () => {
          console.log('Map loaded successfully');
          handleResize();
          setMapError(null);
        });

        map.current.on('error', (e) => {
          console.error('Mapbox error:', e);
          setMapError(`Map error: ${e.error?.message || 'Failed to load map tiles'}`);
          toast.error('Map failed to load. Please refresh the page.');
        });

        map.current.on('styledata', () => {
          console.log('Map style loaded');
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
      })
      .catch(error => {
        console.error('Map initialization error:', error);
        setMapError(`Initialization failed: ${error.message}`);
        toast.error('Failed to initialize map. Please refresh the page.');
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
        
        // Get driving distance using Mapbox Directions API
        const directionsResponse = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${centerCoordinates[0]},${centerCoordinates[1]};${searchCoords[0]},${searchCoords[1]}?access_token=${mapboxToken}`
        );
        const directionsData = await directionsResponse.json();
        
        // Calculate straight-line distance as fallback
        const R = 3959; // Earth's radius in miles
        const lat1 = centerCoordinates[1] * Math.PI / 180;
        const lat2 = searchCoords[1] * Math.PI / 180;
        const dLat = (searchCoords[1] - centerCoordinates[1]) * Math.PI / 180;
        const dLon = (searchCoords[0] - centerCoordinates[0]) * Math.PI / 180;
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const straightLineDistance = R * c;
        
        // Use driving distance if available, otherwise fall back to straight-line
        const drivingDistanceMiles = directionsData.routes?.[0]?.distance 
          ? (directionsData.routes[0].distance * 0.000621371) // meters to miles
          : straightLineDistance;
        const drivingDuration = directionsData.routes?.[0]?.duration 
          ? Math.round(directionsData.routes[0].duration / 60) // seconds to minutes
          : Math.round(straightLineDistance * 1.5); // estimate 1.5 minutes per mile
        
        const isWithinRadius = drivingDistanceMiles <= serviceRadius;
        
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
                <p class="text-sm mt-1"><strong>Driving distance:</strong> ${drivingDistanceMiles.toFixed(1)} miles (~${drivingDuration} min)</p>
                <p class="text-sm"><strong>Straight-line:</strong> ${straightLineDistance.toFixed(1)} miles</p>
                <p class="text-sm font-semibold mt-1 ${isWithinRadius ? 'text-green-600' : 'text-red-600'}">
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
            ? `Address is within service area (${drivingDistanceMiles.toFixed(1)} miles driving distance, ~${drivingDuration} min)`
            : `Address is outside service area (${drivingDistanceMiles.toFixed(1)} miles from center)`
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

  if (mapError) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800 mb-2">Map Error</p>
          <p className="text-xs text-red-700">{mapError}</p>
          <Button
            size="sm"
            className="mt-2"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </div>
        <div className="w-full h-[400px] rounded-lg bg-red-100 flex items-center justify-center">
          <p className="text-sm text-red-700">Map failed to load</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Debug info */}
      <div className="text-xs p-2 bg-yellow-100 rounded">
        Token: {mapboxToken ? '✓' : '✗'} | 
        Center: {centerCoordinates ? '✓' : '✗'} | 
        City: {city || 'none'} | 
        Address: {address || 'none'} | 
        Area: {serviceArea || 'none'}
      </div>
      
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
      <div className="relative w-full h-[400px] rounded-lg overflow-hidden border border-border shadow-lg bg-muted">
        <div ref={mapContainer} className="absolute inset-0" style={{ minHeight: '400px' }} />
        {!centerCoordinates && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 backdrop-blur-sm">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground">Initializing map...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
