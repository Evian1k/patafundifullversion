import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '../../components/ui/button';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface Fundi {
  userId: string;
  name: string;
  phone: string;
  skills: string[];
  location: {
    city: string;
    area: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  experience: number;
  rating: {
    avg: number;
    count: number;
  };
  distanceKm: number;
  subscriptionActive: boolean;
  verified: boolean;
}

interface NearbyFundisMapProps {
  latitude: number;
  longitude: number;
  radius?: number;
  category?: string;
  onSelectFundi?: (fundi: Fundi) => void;
  height?: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '400px',
};

export const NearbyFundisMap: React.FC<NearbyFundisMapProps> = ({
  latitude,
  longitude,
  radius = 10,
  category,
  onSelectFundi,
  height = '400px',
}) => {
  const [fundis, setFundis] = useState<Fundi[]>([]);
  const [selectedFundi, setSelectedFundi] = useState<Fundi | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNearbyFundis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/maps/nearby-fundis?latitude=${latitude}&longitude=${longitude}&radius=${radius}&limit=20`;
      if (category) url += `&category=${encodeURIComponent(category)}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setFundis(data.fundis);
      } else {
        setError('Failed to fetch nearby fundis');
      }
    } catch (err) {
      console.error('Error fetching nearby fundis:', err);
      setError('Error loading fundis');
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, radius, category]);

  useEffect(() => {
    fetchNearbyFundis();
  }, [fetchNearbyFundis]);

  const mapCenter = [latitude, longitude] as [number, number];
  const customStyle = { ...mapContainerStyle, height };
  const containerProps = ({ center: mapCenter, zoom: 13, style: customStyle, scrollWheelZoom: true } as any);

  return (
    <div className="w-full">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Nearby Fundis</h3>
          <p className="text-sm text-gray-500">
            Found {fundis.length} fundis within {radius} km
          </p>
        </div>
        {loading && <div className="text-sm text-blue-600">Loading...</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      <MapContainer {...containerProps}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Circle center={mapCenter} radius={radius * 1000} pathOptions={{ color: '#1d4ed8', fillOpacity: 0.1 }} />

        <Marker position={mapCenter}>
          <Popup>Your location</Popup>
        </Marker>

        {fundis.map((fundi) => (
          <Marker key={fundi.userId} position={[fundi.location.latitude, fundi.location.longitude]}>
            <Popup>
              <div className="space-y-1">
                <h4 className="font-bold">{fundi.name}</h4>
                <p className="text-xs text-gray-500">{fundi.location.address}</p>
                <p className="text-xs">{fundi.skills.join(', ')}</p>
                <p className="text-xs">{fundi.rating.avg.toFixed(1)} ★ ({fundi.rating.count})</p>
                <p className="text-xs">{fundi.distanceKm} km away</p>
                <div className="mt-2">
                  <Button
                    onClick={() => {
                      setSelectedFundi(fundi);
                      if (onSelectFundi) onSelectFundi(fundi);
                    }}
                    className="w-full"
                    size="sm"
                  >
                    Select
                  </Button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {fundis.length > 0 && (
        <div className="mt-6">
          <h4 className="font-semibold mb-3">Fundis List</h4>
          <div className="grid gap-3 max-h-96 overflow-y-auto">
            {fundis.map((fundi) => (
              <div
                key={fundi.userId}
                className="p-3 border rounded-lg hover:shadow-md cursor-pointer transition-shadow"
                onClick={() => setSelectedFundi(fundi)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h5 className="font-semibold">{fundi.name}</h5>
                    <p className="text-sm text-gray-600">{fundi.skills.join(', ')}</p>
                    <div className="flex items-center mt-1">
                      <span className="text-yellow-400">
                        {[...Array(5)].map((_, i) => (i < Math.floor(fundi.rating.avg) ? '★' : '☆'))}
                      </span>
                      <span className="text-xs text-gray-600 ml-1">
                        {fundi.rating.avg.toFixed(1)} ({fundi.rating.count})
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-lg text-blue-600">{fundi.distanceKm} km</div>
                    <div className="text-xs text-gray-500">{fundi.experience} yrs exp.</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fundis.length === 0 && !loading && (
        <div className="mt-6 p-4 text-center text-gray-600">
          <p>No fundis found in your area. Try expanding your search radius.</p>
        </div>
      )}
    </div>
  );
};

export default NearbyFundisMap;
