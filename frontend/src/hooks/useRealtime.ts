import { useState, useEffect } from 'react';
import { realtimeService } from '@/services/realtime';
import { toast } from 'sonner';

/**
 * Hook for real-time job requests and notifications
 */
export function useJobRequest() {
  const [jobRequest, setJobRequest] = useState<any>(null);
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    let interval: number | null = null;

    const handleJobRequest = (data: any) => {
      console.log('Job request received:', data);
      setJobRequest(data);
      
      // Start countdown
      if (data.expiresAt) {
        if (interval) window.clearInterval(interval);
        const expiryTime = new Date(data.expiresAt).getTime();
        interval = window.setInterval(() => {
          const now = Date.now();
          const diff = Math.max(0, Math.floor((expiryTime - now) / 1000));
          setRemaining(diff);
          if (diff === 0 && interval) window.clearInterval(interval);
        }, 1000);
      } else {
        setRemaining(0);
      }
    };

    const handleFundiResponseOk = (data: any) => {
      // ack from server that our accept/decline was processed
      if (data && data.jobId) {
        if (data.accepted) {
          toast.success('Job accepted');
        } else {
          toast('Response recorded');
        }
        setJobRequest(null);
      }
    };

    const handleFundiResponseFailed = (data: any) => {
      const message = data && data.message ? data.message : 'Could not accept job';
      toast.error(message);
    };

    const handleJobAccepted = (data: any) => {
      // another fundi accepted (or we did); clear pending request
      console.log('Job accepted event:', data);
      setJobRequest(null);
    };

    const handleJobRejected = (data: any) => {
      console.log('Job request rejected by another fundi:', data);
      setJobRequest(null);
    };

    realtimeService.on('job:request', handleJobRequest);
    realtimeService.on('job:request:declined', handleJobRejected);
    realtimeService.on('fundi:response:ok', handleFundiResponseOk);
    realtimeService.on('fundi:response:failed', handleFundiResponseFailed);
    realtimeService.on('job:accepted', handleJobAccepted);

    return () => {
      if (interval) window.clearInterval(interval);
      realtimeService.off('job:request', handleJobRequest);
      realtimeService.off('job:request:declined', handleJobRejected);
      realtimeService.off('fundi:response:ok', handleFundiResponseOk);
      realtimeService.off('fundi:response:failed', handleFundiResponseFailed);
      realtimeService.off('job:accepted', handleJobAccepted);
    };
  }, []);

  const acceptJob = (jobId: string) => {
    // send accept; wait for server ack to clear UI
    realtimeService.respondToJobRequest(jobId, true);
  };

  const declineJob = (jobId: string) => {
    realtimeService.respondToJobRequest(jobId, false);
    setJobRequest(null);
  };

  return { jobRequest, remaining, acceptJob, declineJob };
}

/**
 * Hook for real-time chat messages
 */
export function useJobChat(jobId: string | null) {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!jobId) return;

    const handleMessage = (data: any) => {
      if (data.jobId === jobId) {
        setMessages((prev) => [...prev, data.message]);
      }
    };

    realtimeService.on('chat:message', handleMessage);

    return () => {
      realtimeService.off('chat:message', handleMessage);
    };
  }, [jobId]);

  const sendMessage = (content: string) => {
    if (jobId) {
      realtimeService.sendMessage(jobId, content);
    }
  };

  return { messages, sendMessage };
}

/**
 * Hook for location updates
 */
export function useFundiLocation() {
  const [isOnline, setIsOnline] = useState(false);

  const goOnline = (latitude: number, longitude: number, accuracy?: number) => {
    realtimeService.updateLocation(latitude, longitude, accuracy);
    setIsOnline(true);
  };

  const goOffline = () => {
    setIsOnline(false);
  };

  const updateLocation = (latitude: number, longitude: number, accuracy?: number) => {
    if (isOnline) {
      // enforce accuracy threshold (<=50m)
      if (typeof accuracy !== 'undefined' && accuracy > 50) {
        toast.error('Location accuracy too low; move to an open area');
        return false;
      }
      realtimeService.updateLocation(latitude, longitude, accuracy);
      return true;
    }
    return false;
  };

  return { isOnline, goOnline, goOffline, updateLocation };
}
