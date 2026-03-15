/**
 * JobRequestCard - Animated job request card with countdown timer
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, DollarSign, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface JobRequestCardProps {
  jobId: string;
  title: string;
  description: string;
  location: string;
  distance: number;
  remainingSeconds: number;
  onAccept: () => void;
  onDecline: () => void;
}

export function JobRequestCard({
  jobId,
  title,
  description,
  location,
  distance,
  remainingSeconds,
  onAccept,
  onDecline,
}: JobRequestCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      onAccept();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = () => {
    onDecline();
  };

  const isExpired = remainingSeconds <= 0;

  return (
    <AnimatePresence>
      {!isExpired && (
        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-50"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-blue-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
              <h2 className="font-bold text-lg">{title}</h2>
              <p className="text-sm opacity-90">{description.substring(0, 60)}...</p>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              {/* Location */}
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">{location}</p>
                  <p className="text-xs text-gray-400">{distance.toFixed(1)} km away</p>
                </div>
              </div>

              {/* Countdown Timer */}
              <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-lg">
                <Clock className="w-4 h-4 text-blue-600" />
                <div className="flex-1">
                  <p className="text-xs text-gray-600">Expires in</p>
                  <p className={`text-lg font-bold ${remainingSeconds <= 5 ? 'text-red-600' : 'text-blue-600'}`}>
                    {remainingSeconds}s
                  </p>
                </div>
                {remainingSeconds <= 5 && (
                  <AlertCircle className="w-4 h-4 text-red-600 animate-pulse" />
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                <motion.div
                  className="bg-blue-600 h-full"
                  initial={{ width: '100%' }}
                  animate={{ width: `${(remainingSeconds / 20) * 100}%` }}
                  transition={{ duration: 0.1, ease: 'linear' }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 p-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDecline}
                disabled={isProcessing}
              >
                Decline
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleAccept}
                disabled={isProcessing}
              >
                {isProcessing ? 'Accepting...' : 'Accept'}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
