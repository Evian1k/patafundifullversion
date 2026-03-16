import { motion } from 'framer-motion';
import { MapPin, Timer, Wrench, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function JobRequestModal({
  request,
  remainingSec,
  onAccept,
  onDecline,
}: {
  request: any;
  remainingSec: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const title = request?.title || request?.category || 'New Job Request';
  const description = request?.description || '';
  const distanceKm = typeof request?.distanceKm === 'number' ? request.distanceKm : null;
  const estimatedPrice = request?.estimatedPrice != null ? Number(request.estimatedPrice) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden"
      >
        <div className="p-5 border-b flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-orange-600" />
            <div>
              <p className="text-sm text-gray-500">Incoming request</p>
              <h2 className="text-lg font-semibold text-gray-900 leading-tight">{title}</h2>
            </div>
          </div>
          <button
            onClick={onDecline}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
            type="button"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Timer className="w-4 h-4" />
                <span>Time left</span>
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900">
                {Math.max(0, remainingSec)}s
              </div>
            </div>
            <div className="rounded-xl border bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <MapPin className="w-4 h-4" />
                <span>Distance</span>
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900">
                {distanceKm != null ? `${distanceKm.toFixed(1)} km` : '—'}
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-sm text-gray-600">Estimated pay</div>
            <div className="text-xl font-bold text-gray-900">
              {Number.isFinite(estimatedPrice as any) ? `KES ${estimatedPrice!.toFixed(0)}` : '—'}
            </div>
          </div>

          {description ? (
            <div className="rounded-xl border p-3">
              <div className="text-sm text-gray-600 mb-1">Job details</div>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{description}</p>
            </div>
          ) : null}
        </div>

        <div className="p-5 border-t bg-white flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onDecline}>
            Decline
          </Button>
          <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={onAccept}>
            Accept
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

