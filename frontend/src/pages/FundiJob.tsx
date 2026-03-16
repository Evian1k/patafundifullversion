import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Navigation, Phone, MessageCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { realtimeService } from '@/services/realtime';

type Job = {
  id: string;
  title: string;
  description: string;
  category?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  status: string;
  estimatedPrice?: number | null;
  finalPrice?: number | null;
};

function openGoogleMaps(lat: number, lng: number) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function FundiJob() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const token = useMemo(() => localStorage.getItem('auth_token'), []);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalPrice, setFinalPrice] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [completing, setCompleting] = useState(false);
  const [otpConfirmed, setOtpConfirmed] = useState(false);

  useEffect(() => {
    if (!token) return;
    realtimeService.connect(token);
    return () => realtimeService.disconnect();
  }, [token]);

  useEffect(() => {
    const fetchJob = async () => {
      if (!jobId) return;
      try {
        const res = await apiClient.getJob(jobId);
        setJob(res.job);
      } catch (e) {
        toast.error('Failed to load job');
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [jobId]);

  useEffect(() => {
    const onStatus = (payload: any) => {
      if (!payload || payload.jobId !== jobId) return;
      setJob((prev) => (prev ? { ...prev, status: payload.status } : prev));
    };
    const onConfirmed = (payload: any) => {
      if (!payload || payload.jobId !== jobId) return;
      setOtpConfirmed(true);
      toast.success('Customer confirmed completion');
    };
    realtimeService.on('job:status', onStatus);
    realtimeService.on('job:completion:confirmed', onConfirmed);
    return () => {
      realtimeService.off('job:status', onStatus);
      realtimeService.off('job:completion:confirmed', onConfirmed);
    };
  }, [jobId]);

  const captureCoords = async () => {
    if (!navigator.geolocation) throw new Error('Geolocation not supported');
    const p = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });
    return { latitude: p.coords.latitude, longitude: p.coords.longitude };
  };

  const step = async (nextStatus: 'on_the_way' | 'arrived' | 'in_progress') => {
    if (!jobId) return;
    try {
      const { latitude, longitude } = await captureCoords();
      await apiClient.checkInToJob(jobId, latitude, longitude, nextStatus);
      setJob((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      toast.success('Updated');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed';
      toast.error(msg);
    }
  };

  const onComplete = async () => {
    if (!jobId) return;
    if (!finalPrice) {
      toast.error('Enter final price');
      return;
    }
    setCompleting(true);
    try {
      await apiClient.completeJob(jobId, finalPrice, photos);
      toast.success('Job completed. Customer OTP required.');
      setJob((prev) => (prev ? { ...prev, status: 'completed' } : prev));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to complete job';
      toast.error(msg);
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen p-6">
        <Button variant="outline" onClick={() => navigate('/fundi')}>
          Back
        </Button>
        <p className="mt-4 text-gray-700">Job not found.</p>
      </div>
    );
  }

  const canNavigate = job.latitude != null && job.longitude != null;
  const status = (job.status || '').toLowerCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Active Job</h1>
            <p className="text-sm text-gray-600">Status: {job.status}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/fundi')}>
            Back
          </Button>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow p-5 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">Service</p>
              <h2 className="text-lg font-semibold text-gray-900">{job.title}</h2>
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{job.description}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Estimated</p>
              <p className="text-lg font-bold text-gray-900">
                {job.estimatedPrice != null ? `KES ${Number(job.estimatedPrice).toFixed(0)}` : '—'}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => (canNavigate ? openGoogleMaps(Number(job.latitude), Number(job.longitude)) : toast.error('No customer GPS pin'))}
              disabled={!canNavigate}
            >
              <Navigation className="w-4 h-4 mr-2" />
              Navigate
            </Button>
            <Button variant="outline" onClick={() => toast('Chat coming next (socket ready)')}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat
            </Button>
            <Button variant="outline" onClick={() => toast('Call from profile (customer phone) coming next')}>
              <Phone className="w-4 h-4 mr-2" />
              Call
            </Button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Job Controls</h3>

          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={status !== 'accepted'}
              onClick={() => step('on_the_way')}
            >
              <MapPin className="w-4 h-4 mr-2" />
              En Route
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              disabled={status !== 'on_the_way'}
              onClick={() => step('arrived')}
            >
              Arrived
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              disabled={status !== 'arrived'}
              onClick={() => step('in_progress')}
            >
              Start Work
            </Button>
          </div>

          <div className="border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-700">Final price (KES)</label>
                <input
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 bg-white"
                  placeholder="e.g. 2000"
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className="text-sm text-gray-700">Completion photos</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="mt-1 w-full"
                  onChange={(e) => setPhotos(Array.from(e.target.files || []))}
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <Button
                className="bg-green-600 hover:bg-green-700"
                disabled={status !== 'in_progress' || completing}
                onClick={onComplete}
              >
                Complete Job
              </Button>
              {job.status === 'completed' ? (
                <div className="text-sm text-gray-700 flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${otpConfirmed ? 'text-green-600' : 'text-gray-400'}`} />
                  {otpConfirmed ? 'Customer confirmed OTP' : 'Waiting for customer OTP'}
                </div>
              ) : null}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

