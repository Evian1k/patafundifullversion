/**
 * FundiDashboard - Dashboard for registered fundis
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api';
import { realtimeService } from '@/services/realtime';
import { useJobRequest } from '@/hooks/useRealtime';
import {
  BarChart3,
  Wallet,
  AlertCircle,
  TrendingUp,
  MapPin,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getMaxGpsAccuracyMeters } from '@/lib/gps';
import { JobRequestModal } from '@/components/fundi/JobRequestModal';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface DashboardData {
  verificationStatus: string;
  profileCompletion: number;
  online: boolean;
  walletBalance: number;
  jobStats: {
    newRequests: number;
    activeJobs: number;
    completedJobs: number;
  };
  ratings: {
    average: number;
    total: number;
  };
}

export function FundiDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const maxAccuracyMeters = getMaxGpsAccuracyMeters();
  const { jobRequest, remaining, acceptJob, declineJob } = useJobRequest();

  const [coords, setCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [subscriptionActive, setSubscriptionActive] = useState<boolean | null>(null);
  const [subscriptionDaysLeft, setSubscriptionDaysLeft] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const mapRef = useRef<L.Map | null>(null);
  const fundiMarkerRef = useRef<L.Marker | null>(null);
  const jobMarkerRef = useRef<L.Marker | null>(null);
  const socketToken = useMemo(() => localStorage.getItem('auth_token'), []);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const me = await apiClient.getCurrentUser();
        const role = (me?.user?.role || "").toLowerCase();
        if (role === "customer") {
          navigate("/dashboard");
          return;
        }
        if (role === "fundi_pending") {
          navigate("/fundi/pending");
          return;
        }

        const response = await apiClient.getFundiDashboard();
        setDashboard(response.dashboard);
        try {
          const st = await apiClient.getFundiStatus();
          if (st?.status) {
            setIsOnline(Boolean(st.status.online));
            setSubscriptionActive(Boolean(st.status.subscriptionActive));
            setSubscriptionDaysLeft(
              typeof st.status.daysLeft === 'number' ? st.status.daysLeft : null
            );
          }
        } catch {
          // ignore status fetch errors
        }
      } catch (error) {
        const status = (error as any)?.status;
        const metaCode = (error as any)?.meta?.code;
        const msg = error instanceof Error ? error.message : 'Failed to load dashboard';

        // Auth/session problems: send user to login and clear stale token.
        if (status === 401) {
          apiClient.setToken(null);
          navigate('/auth');
          return;
        }

        // Fundi is approved but must verify OTP (or role not yet promoted).
        if (status === 403 && (metaCode === 'FUNDI_OTP_REQUIRED' || /otp required/i.test(msg))) {
          navigate('/fundi/pending');
          return;
        }

        // If fundi access is denied (not approved yet), show pending screen which explains next steps.
        if (status === 403 && /not approved|access denied/i.test(msg)) {
          navigate('/fundi/pending');
          return;
        }

        try {
          const s = await apiClient.getFundiApprovalStatus();
          if (s?.gates?.otpRequired || s?.user?.role === "fundi_pending") {
            navigate("/fundi/pending");
            return;
          }
        } catch {
          // ignore
        }
        toast.error(msg || 'Failed to load dashboard');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [navigate]);

  useEffect(() => {
    if (!socketToken) return;
    realtimeService.connect(socketToken);
    return () => realtimeService.disconnect();
  }, [socketToken]);

  useEffect(() => {
    const onOk = (data: any) => {
      if (data?.accepted && data?.jobId) {
        navigate(`/fundi/job/${data.jobId}`);
      }
    };
    realtimeService.on('fundi:response:ok', onOk);
    return () => realtimeService.off('fundi:response:ok', onOk);
  }, [navigate]);

  useEffect(() => {
    const el = document.getElementById('fundi-map');
    if (!el || mapRef.current) return;
    mapRef.current = L.map(el, { zoomControl: true }).setView([-1.286389, 36.817223], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapRef.current);
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    if (coords) {
      const latlng: [number, number] = [coords.latitude, coords.longitude];
      if (!fundiMarkerRef.current) {
        fundiMarkerRef.current = L.marker(latlng).addTo(mapRef.current);
      } else {
        fundiMarkerRef.current.setLatLng(latlng);
      }
      mapRef.current.setView(latlng, 15, { animate: true });
    }

    if (jobRequest?.latitude != null && jobRequest?.longitude != null) {
      const jl: [number, number] = [Number(jobRequest.latitude), Number(jobRequest.longitude)];
      if (!jobMarkerRef.current) {
        jobMarkerRef.current = L.marker(jl).addTo(mapRef.current);
      } else {
        jobMarkerRef.current.setLatLng(jl);
      }
    } else if (jobMarkerRef.current) {
      jobMarkerRef.current.remove();
      jobMarkerRef.current = null;
    }
  }, [coords, jobRequest]);

  const stopLocationWatch = () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const handleGoOnline = async () => {
    try {
      // Request user's location
      if (!navigator.geolocation) {
        toast.error('Geolocation not supported');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const roundedAcc = typeof accuracy === 'number' ? Math.round(accuracy) : null;

          // Warn but don't block: backend enforces strict rules in production.
          if (roundedAcc != null && roundedAcc > maxAccuracyMeters) {
            toast.warning(`Low GPS accuracy: ${roundedAcc}m (target ≤ ${Math.round(maxAccuracyMeters)}m).`);
          }

          try {
            const accToSend =
              roundedAcc != null && Number.isFinite(roundedAcc) && roundedAcc < 1000000 ? roundedAcc : undefined;
            const resp = await apiClient.goOnline(latitude, longitude, accToSend);
            if (resp?.warning) toast.warning(resp.warning);

            // Connect realtime
            const token = localStorage.getItem('auth_token');
            if (token) {
              realtimeService.connect(token);
            }

            setCoords({ latitude, longitude, accuracy: accToSend ?? undefined });

            stopLocationWatch();
            watchIdRef.current = navigator.geolocation.watchPosition(
              (p) => {
                const now = Date.now();
                if (now - lastSentAtRef.current < 3500) return;
                lastSentAtRef.current = now;
                const a = typeof p.coords.accuracy === 'number' ? Math.round(p.coords.accuracy) : undefined;
                setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: a });
                realtimeService.updateLocation(p.coords.latitude, p.coords.longitude, a, true);
              },
              (e) => {
                toast.error(`Location tracking error: ${e.message}`);
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );

            setIsOnline(true);
            toast.success('You are now online');
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to go online';
            toast.error(msg);
            console.error(error);
          }
        },
        (error) => {
          toast.error(`Geolocation error: ${error.message}`);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } catch (error) {
      toast.error('Failed to go online');
      console.error(error);
    }
  };

  const handleGoOffline = async () => {
    try {
      await apiClient.goOffline();
      stopLocationWatch();
      if (coords) realtimeService.updateLocation(coords.latitude, coords.longitude, coords.accuracy, false);
      realtimeService.disconnect();
      setIsOnline(false);
      toast.success('You are now offline');
    } catch (error) {
      toast.error('Failed to go offline');
      console.error(error);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
      navigate('/auth');
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <AlertCircle className="w-6 h-6 text-red-600 mr-2" />
        <p className="text-gray-600">Failed to load dashboard</p>
      </div>
    );
  }

  const statusColor = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    suspended: 'bg-red-100 text-red-800',
  };

  const statColor = statusColor[dashboard.verificationStatus as keyof typeof statusColor] || 'bg-gray-100 text-gray-800';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {isOnline && jobRequest ? (
        <JobRequestModal
          request={jobRequest}
          remainingSec={remaining}
          onAccept={() => acceptJob(jobRequest.jobId)}
          onDecline={() => declineJob(jobRequest.jobId)}
        />
      ) : null}

      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Fundi Dashboard</h1>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto mb-6 bg-white rounded-xl shadow-lg p-6"
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Verification Status</p>
            <span className={`inline-block px-4 py-2 rounded-full font-semibold text-sm ${statColor}`}>
              {dashboard.verificationStatus.charAt(0).toUpperCase() + dashboard.verificationStatus.slice(1)}
            </span>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 mb-2">Profile Completion</p>
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                initial={{ width: 0 }}
                animate={{ width: `${dashboard.profileCompletion}%` }}
                transition={{ duration: 1 }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">{dashboard.profileCompletion}%</p>
          </div>
        </div>

        {/* Online Status */}
        <div className="flex gap-2 pt-4 border-t">
          {!isOnline ? (
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleGoOnline}
            >
              <MapPin className="w-4 h-4 mr-2" />
              Go Online
            </Button>
          ) : (
            <Button
              variant="outline"
              className="flex-1 border-green-600 text-green-600"
              onClick={handleGoOffline}
            >
              <div className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse" />
              Online
            </Button>
          )}
        </div>
      </motion.div>

      {/* Subscription */}
      {subscriptionActive === false ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between gap-3"
        >
          <div>
            <p className="font-semibold text-yellow-900">Subscription inactive</p>
            <p className="text-sm text-yellow-800">
              Activate a subscription to accept jobs.
            </p>
          </div>
          <Button
            className="bg-orange-600 hover:bg-orange-700"
            onClick={async () => {
              try {
                const r = await apiClient.activateSubscription('monthly');
                if (r?.warning) toast.warning(r.warning);
                const st = await apiClient.getFundiStatus();
                setSubscriptionActive(Boolean(st?.status?.subscriptionActive));
                setSubscriptionDaysLeft(
                  typeof st?.status?.daysLeft === 'number' ? st.status.daysLeft : null
                );
                toast.success('Subscription activated');
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'Failed to activate subscription';
                toast.error(msg);
              }
            }}
          >
            Activate
          </Button>
        </motion.div>
      ) : subscriptionActive === true ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto mb-6 bg-white rounded-xl shadow p-4 flex items-center justify-between gap-3"
        >
          <div>
            <p className="font-semibold text-gray-900">Subscription active</p>
            <p className="text-sm text-gray-600">
              {subscriptionDaysLeft != null ? `${subscriptionDaysLeft} day(s) left` : 'Active'}
            </p>
          </div>
          <div className="text-xs text-gray-500">Ready to accept jobs</div>
        </motion.div>
      ) : null}

      {/* Live Map */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto mb-6 bg-white rounded-xl shadow-lg p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Live Map</h2>
          <div className="text-xs text-gray-600">
            {coords?.accuracy != null ? `Accuracy ±${coords.accuracy}m` : 'Accuracy —'}
          </div>
        </div>
        <div id="fundi-map" className="w-full h-64 rounded-lg overflow-hidden border" />
        {!isOnline ? (
          <p className="text-xs text-gray-500 mt-2">
            Go online to start live location tracking and receive job requests.
          </p>
        ) : null}
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ staggerChildren: 0.1 }}
        className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
      >
        {/* Wallet */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Wallet Balance</p>
              <p className="text-2xl font-bold text-blue-600">KES {(dashboard.walletBalance ?? 0).toFixed(2)}</p>
            </div>
            <Wallet className="w-10 h-10 text-blue-600 opacity-20" />
          </div>
        </motion.div>

        {/* Jobs Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Jobs</p>
              <p className="text-2xl font-bold text-green-600">{dashboard.jobStats.activeJobs}</p>
              <p className="text-xs text-gray-500 mt-1">{dashboard.jobStats.newRequests} new requests</p>
            </div>
            <BarChart3 className="w-10 h-10 text-green-600 opacity-20" />
          </div>
        </motion.div>

        {/* Ratings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Rating</p>
              <p className="text-2xl font-bold text-yellow-600">
                {typeof dashboard.ratings?.average === 'number' ? dashboard.ratings.average.toFixed(1) : '—'} ⭐
              </p>
              <p className="text-xs text-gray-500 mt-1">{dashboard.ratings.total} reviews</p>
            </div>
            <TrendingUp className="w-10 h-10 text-yellow-600 opacity-20" />
          </div>
        </motion.div>
      </motion.div>

      {/* Completed Jobs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6"
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Lifetime Stats</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Completed Jobs</p>
            <p className="text-3xl font-bold text-purple-600">{dashboard.jobStats.completedJobs}</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Estimated Earnings</p>
            <p className="text-3xl font-bold text-indigo-600">KES {(Number(dashboard.walletBalance ?? 0) * 2).toFixed(0)}</p>
          </div>
        </div>
      </motion.div>

      {/* Notice */}
      {dashboard.verificationStatus !== 'approved' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-yellow-900">Verification Pending</p>
            <p className="text-sm text-yellow-800 mt-1">
              Your account is being reviewed by our team. You will receive an email once approved.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
