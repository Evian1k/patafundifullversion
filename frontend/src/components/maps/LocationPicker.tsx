import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

interface PlacePrediction {
  place_id: string;
  main_text: string;
  secondary_text: string;
  description: string;
}

interface LocationPickerProps {
  onSelectLocation: (location: {
    address: string;
    latitude: number;
    longitude: number;
    placeId: string;
  }) => void;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  onSelectLocation,
  defaultValue = '',
  placeholder = 'Search for an address...',
  className = '',
}) => {
  const [input, setInput] = useState(defaultValue);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounced fetch predictions
  const fetchPredictions = useCallback(async (searchInput: string) => {
    if (!searchInput || searchInput.length < 2) {
      setPredictions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/maps/place-predictions?input=${encodeURIComponent(searchInput)}`
      );
      const data = await response.json();

      if (data.success) {
        setPredictions(data.predictions || []);
        setShowPredictions(true);
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer for debounced search
    debounceTimer.current = setTimeout(() => {
      fetchPredictions(value);
    }, 300);
  };

  const handleSelectPrediction = async (placeId: string, description: string) => {
    try {
      const response = await fetch(`/api/maps/place-details/${placeId}`);
      const data = await response.json();

      if (data.success) {
        const location = data.data;
        setInput(location.address);
        setPredictions([]);
        setShowPredictions(false);

        onSelectLocation({
          address: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
          placeId: placeId,
        });
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.location-picker-container')) {
        setShowPredictions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`location-picker-container ${className}`}>
      <Input
        type="text"
        value={input}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="w-full"
        autoComplete="off"
      />

      {loading && <div className="text-sm text-gray-500 mt-1">Searching...</div>}

      {showPredictions && predictions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 max-h-64 overflow-y-auto">
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b last:border-b-0"
              onClick={() =>
                handleSelectPrediction(prediction.place_id, prediction.description)
              }
            >
              <div className="font-medium">{prediction.main_text}</div>
              <div className="text-sm text-gray-600">{prediction.secondary_text}</div>
            </button>
          ))}
        </div>
      )}

      {showPredictions && predictions.length === 0 && input.length >= 2 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg p-2 text-sm text-gray-500 z-50">
          No results found
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
