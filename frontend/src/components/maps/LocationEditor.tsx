import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import LocationPicker from './LocationPicker';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface LocationEditorProps {
  onSaveLocation: (location: {
    address: string;
    city: string;
    area: string;
    latitude: number;
    longitude: number;
  }) => Promise<void>;
  currentLocation?: {
    address: string;
    city: string;
    area: string;
    latitude: number;
    longitude: number;
  };
  loading?: boolean;
}

const mapContainerStyle = { width: '100%', height: '300px' };

export const LocationEditor: React.FC<LocationEditorProps> = ({
  onSaveLocation,
  currentLocation,
  loading = false,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<{
    address: string;
    latitude: number;
    longitude: number;
  } | null>(
    currentLocation
      ? {
          address: currentLocation.address,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        }
      : null
  );

  const [area, setArea] = useState(currentLocation?.area || '');
  const [city, setCity] = useState(currentLocation?.city || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSelectLocation = (location: {
    address: string;
    latitude: number;
    longitude: number;
    placeId: string;
  }) => {
    setSelectedLocation({
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
    });
  };

  const handleSave = async () => {
    if (!selectedLocation) {
      alert('Please select a location');
      return;
    }

    if (!city || !area) {
      alert('Please fill in city and area');
      return;
    }

    setIsSaving(true);
    try {
      await onSaveLocation({
        address: selectedLocation.address,
        city,
        area,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch('/api/maps/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude, longitude }),
          });
          const data = await response.json();

          if (data.success) {
            setSelectedLocation({ address: data.data.address, latitude, longitude });
          } else {
            setSelectedLocation({ address: `${latitude}, ${longitude}`, latitude, longitude });
          }
        } catch (error) {
          console.error('Error reverse geocoding:', error);
          setSelectedLocation({ address: `${latitude}, ${longitude}`, latitude, longitude });
        }
      },
      (error) => {
        alert('Error getting current location: ' + error.message);
      }
    );
  };

  const mapCenter = selectedLocation ? [selectedLocation.latitude, selectedLocation.longitude] as [number, number] : undefined;
  const containerProps = mapCenter
    ? ({ center: mapCenter, zoom: 15, style: mapContainerStyle } as any)
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold">Select Your Location</Label>
        <p className="text-sm text-gray-600 mb-3">Customers will use this location to find you</p>

        <div className="space-y-3">
          <LocationPicker
            onSelectLocation={handleSelectLocation}
            defaultValue={currentLocation?.address}
            placeholder="Search for your address or business location..."
          />

          <Button type="button" variant="outline" onClick={handleUseCurrentLocation} className="w-full">
            📍 Use My Current Location
          </Button>
        </div>
      </div>

      {selectedLocation && (
        <div className="space-y-4">
          <div>
            <Label>Selected Address</Label>
            <div className="p-3 bg-gray-50 rounded border text-sm">{selectedLocation.address}</div>
          </div>

          <MapContainer {...containerProps}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[selectedLocation.latitude, selectedLocation.longitude]} />
          </MapContainer>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City/Town</Label>
              <Input id="city" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Nairobi" />
            </div>
            <div>
              <Label htmlFor="area">Area/Estate</Label>
              <Input id="area" type="text" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g., Westlands" />
            </div>
          </div>

          <Button onClick={handleSave} disabled={isSaving || loading} className="w-full" size="lg">
            {isSaving || loading ? 'Saving...' : 'Save Location'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default LocationEditor;
