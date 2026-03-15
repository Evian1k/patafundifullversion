/**
 * FundiDashboard - Dashboard for registered fundis
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api';
import { realtimeService } from '@/services/realtime';
import {
  BarChart3,
  Wallet,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  MapPin,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await apiClient.getFundiDashboard();
        setDashboard(response.dashboard);
      } catch (error) {
        toast.error('Failed to load dashboard');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

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

          // Check accuracy
          if (accuracy > 150) {
            toast.error('GPS accuracy is poor (> 150m). Please move to an open area.');
            return;
          }

          try {
            await apiClient.goOnline(latitude, longitude, accuracy);

            // Connect realtime
            const token = localStorage.getItem('auth_token');
            if (token) {
              realtimeService.connect(token);
            }

            setIsOnline(true);
            toast.success('You are now online');
          } catch (error) {
            toast.error('Failed to go online');
            console.error(error);
          }
        },
        (error) => {
          toast.error(`Geolocation error: ${error.message}`);
        }
      );
    } catch (error) {
      toast.error('Failed to go online');
      console.error(error);
    }
  };

  const handleGoOffline = async () => {
    try {
      await apiClient.goOffline();
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
