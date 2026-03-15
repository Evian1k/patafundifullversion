/**
 * Camera Capture Component - Captures selfie using device camera
 */

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, RotateCcw, Download, AlertCircle, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CameraCaptureProps {
  onCapture: (blob: Blob, preview: string) => void;
  onError?: (error: string) => void;
  label?: string;
}

export function CameraCapture({ onCapture, onError, label = 'Capture Selfie' }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const startCamera = async () => {
    setLoading(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Camera access denied';
      toast.error(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Flip horizontally for front camera
    if (facingMode === 'user') {
      context.scale(-1, 1);
      context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    } else {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPreview(url);
        onCapture(blob, url);
        toast.success('Photo captured successfully');
      }
    }, 'image/jpeg', 0.95);
  };

  const toggleFacing = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setPreview(null);
      setFacingMode(facingMode === 'user' ? 'environment' : 'user');
    }
  };

  const reset = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setPreview(null);
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg border border-gray-200"
    >
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Camera className="w-5 h-5 text-blue-600" />
        {label}
      </h3>

      {!stream && !preview ? (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              Camera must be well-lit and face clearly visible. No hats or sunglasses.
            </p>
          </div>

          <Button
            onClick={startCamera}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 mr-2" />
                Start Camera
              </>
            )}
          </Button>
        </div>
      ) : preview ? (
        <div className="space-y-4">
          <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
            <img
              src={preview}
              alt="Captured selfie"
              className="w-full h-full object-cover"
            />
          </div>

          <p className="text-sm text-green-700 font-semibold flex items-center gap-2">
            <span className="w-2 h-2 bg-green-600 rounded-full" />
            Photo captured
          </p>

          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} className="flex-1">
              <RotateCcw className="w-4 h-4 mr-2" />
              Retake
            </Button>
            <Button onClick={reset} className="flex-1 bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4 mr-2" />
              Continue
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="aspect-video rounded-lg overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={toggleFacing} className="flex-1">
              🔄 Switch
            </Button>
            <Button onClick={capturePhoto} className="flex-1 bg-green-600 hover:bg-green-700">
              <Camera className="w-4 h-4 mr-2" />
              Capture
            </Button>
          </div>

          <Button variant="outline" onClick={reset} className="w-full">
            Cancel
          </Button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </motion.div>
  );
}
