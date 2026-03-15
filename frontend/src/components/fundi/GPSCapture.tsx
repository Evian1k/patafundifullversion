/**
 * GPS Capture Component - Captures device GPS location with map preview
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapPin, AlertCircle, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface GPSData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  timestamp: number;
}

interface GPSCaptureProps {
  onCapture: (gps: GPSData) => void;
  onError?: (error: string) => void;
}

export function GPSCapture({ onCapture, onError }: GPSCaptureProps) {
  const [gpsData, setGpsData] = useState<GPSData | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  useEffect(() => {
    if (gpsData) {
      // Generate Google Maps preview URL
      const url = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.8195${gpsData.latitude}!2d${gpsData.longitude}!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zLatitude%20${gpsData.latitude.toFixed(4)}%2C%20Longitude%20${gpsData.longitude.toFixed(4)}!5e0!3m2!1sen!2ske!4v${Date.now()}`;
      setMapUrl(url);
    }
  }, [gpsData]);

  const captureLocation = async () => {
    setLoading(true);
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation not supported on this device');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });

      const { latitude, longitude, accuracy: acc, altitude } = position.coords;

      const data: GPSData = {
        latitude,
        longitude,
        accuracy: Math.round(acc),
        altitude,
        timestamp: Date.now(),
      };

      setAccuracy(Math.round(acc));

      // Check accuracy threshold
      if (Math.round(acc) > 150) {
        toast.warning(`GPS accuracy is ${Math.round(acc)}m. Move to an open area for better accuracy.`);
        setGpsData(data);
        return;
      }

      setGpsData(data);
      toast.success('Location captured successfully');
    } catch (error) {
      const message =
        error instanceof GeolocationPositionError
          ? `Geolocation error: ${error.message}`
          : String(error);

      toast.error(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!gpsData) return;

    if (gpsData.accuracy > 150) {
      toast.error('GPS accuracy too poor. Please recapture in an open area.');
      return;
    }

    onCapture(gpsData);
    toast.success('Location confirmed');
  };

  const handleRetry = () => {
    setGpsData(null);
    setMapUrl(null);
    setAccuracy(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg border border-gray-200"
    >
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-blue-600" />
        GPS Location
      </h3>

      {!gpsData ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Allow access to your device's location to capture GPS coordinates.
          </p>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              For best results, use your device outdoors with clear sky view.
            </p>
          </div>

          <Button
            onClick={captureLocation}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Capturing...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-2" />
                Capture Location
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Accuracy Status */}
          <div
            className={`p-3 rounded-lg ${
              accuracy && accuracy <= 150
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}
          >
            <p className={`text-sm font-semibold ${accuracy && accuracy <= 150 ? 'text-green-800' : 'text-yellow-800'}`}>
              Accuracy: ±{accuracy}m
            </p>
            {accuracy && accuracy <= 150 && (
              <p className="text-xs text-green-700 mt-1">✓ Accuracy is acceptable</p>
            )}
            {accuracy && accuracy > 150 && (
              <p className="text-xs text-yellow-700 mt-1">
                ⚠ Move to an open area for better accuracy
              </p>
            )}
          </div>

          {/* Coordinates */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600 font-mono">
              Lat: {gpsData.latitude.toFixed(6)}
              <br />
              Lon: {gpsData.longitude.toFixed(6)}
              <br />
              Alt: {gpsData.altitude ? `${gpsData.altitude.toFixed(1)}m` : 'N/A'}
            </p>
          </div>

          {/* Map Preview */}
          {mapUrl && (
            <div className="aspect-square rounded-lg overflow-hidden border border-gray-200">
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                src={`https://www.google.com/maps?q=${gpsData.latitude},${gpsData.longitude}&z=16&output=embed`}
                allowFullScreen={false}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRetry} className="flex-1">
              Recapture
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={accuracy ? accuracy > 150 : false}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Confirm
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
