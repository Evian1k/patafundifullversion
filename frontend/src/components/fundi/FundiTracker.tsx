import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, MessageCircle, X, Navigation, ShieldCheck, Wrench } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '@/lib/api';
import './fundi-tracker.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { toast } from 'sonner';

// Fix Leaflet marker icons
delete ((L.Icon.Default.prototype as unknown) as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface FundiInfo {
  id: string;
  name: string;
  skill: string;
  distanceKm: number;
  rating: number;
  avatarUrl?: string;
}

type Status =
  | 'searching'
  | 'found'
  | 'matched'
  | 'accepted'
  | 'on_the_way'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'failed';

function normalizeJobStatus(raw?: string): Status {
  const s = String(raw || '').toLowerCase().trim();
  // Backend statuses: requested, pending, matching, accepted, on_the_way, arrived, in_progress, completed, cancelled
  if (!s) return 'searching';
  if (['requested', 'pending', 'matching', 'searching'].includes(s)) return 'searching';
  if (s === 'matched') return 'matched';
  if (s === 'accepted') return 'accepted';
  if (s === 'on_the_way') return 'on_the_way';
  if (s === 'arrived') return 'arrived';
  if (s === 'in_progress') return 'in_progress';
  if (s === 'completed') return 'completed';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'failed') return 'failed';
  // Unknown status should not blank the UI
  return 'searching';
}

export default function FundiTracker({
  onComplete,
  jobId,
}: {
  onComplete?: () => void;
  jobId?: string;
}) {
  const [jobStatusRaw, setJobStatusRaw] = useState<string>('searching');
  const status = normalizeJobStatus(jobStatusRaw);
  const [fundi, setFundi] = useState<FundiInfo | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [progressMsg, setProgressMsg] = useState('Finding nearby fundi...');
  const [searchRadiusKm, setSearchRadiusKm] = useState<number | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [searchFailed, setSearchFailed] = useState<boolean>(false);
  const blockBackRef = useRef<boolean>(false);
  const socketRef = useRef<Socket | null>(null);
  const [customerLocation, setCustomerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [fundiLocation, setFundiLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasAuth, setHasAuth] = useState<boolean>(true);
  const [completionOtp, setCompletionOtp] = useState('');
  const [completionConfirmed, setCompletionConfirmed] = useState(false);
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'initiated' | 'confirmed' | 'failed'>('idle');
  const [paymentMsg, setPaymentMsg] = useState<string>('');

  const mapRef = useRef<L.Map | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const fundiMarkerRef = useRef<L.Marker | null>(null);
  const searchCircleRef = useRef<L.Circle | null>(null);
  const searchPulseTimerRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Check auth status
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token || !jobId) {
      setHasAuth(false);
    }
  }, [jobId]);

  // Prevent back navigation during searching
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (blockBackRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    blockBackRef.current = status === 'searching' || status === 'matched' || status === 'accepted';

    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [status]);

  // Initialize socket and job listener
  useEffect(() => {
    if (!hasAuth || !jobId) {
      return;
    }

    const token = localStorage.getItem('auth_token');
    console.log('FundiTracker: initializing socket, jobId=', jobId, 'token=', !!token);
    
    if (!token) {
      console.error('No auth token found - user must be logged in');
      setJobStatusRaw('failed');
      return;
    }
    
    const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000', {
      transports: ['websocket'],
      reconnectionAttempts: 3,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
      socket.emit('auth:token', token);
    });

    socket.on('auth:ok', () => {
      console.log('Socket authenticated');
      setProgressMsg('Connecting to fundi...');
    });
    
    socket.on('auth:error', (err) => {
      console.error('Socket auth error:', err);
      setJobStatusRaw('failed');
    });
    
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setJobStatusRaw('failed');
    });

    socket.on('job:matching', (payload) => {
      // { jobId, candidates: [...] }
      if (!payload || payload.jobId !== jobId) return;
      setSearchFailed(false);
      setJobStatusRaw('matching');
      const count = Array.isArray(payload.candidates) ? payload.candidates.length : null;
      const radius = payload.radiusKm != null ? Number(payload.radiusKm) : null;
      const price = payload.estimatedPrice != null ? Number(payload.estimatedPrice) : null;
      if (Number.isFinite(radius as any)) setSearchRadiusKm(radius);
      if (Number.isFinite(price as any)) setEstimatedPrice(price);
      if (count && radius) {
        setProgressMsg(`Notifying ${count} fundis within ${radius} km...`);
      } else if (count) {
        setProgressMsg(`Notifying ${count} nearby fundis...`);
      } else if (radius) {
        setProgressMsg(`Searching within ${radius} km...`);
      } else {
        setProgressMsg('Notifying nearby fundis...');
      }
    });

    socket.on('job:matched', async (payload) => {
      console.log('Received job:matched', payload);
      if (!payload || payload.jobId !== jobId) return;
      setJobStatusRaw('matched');
      // fetch fundi profile
      try {
        const fundiRes = await apiClient.getFundi(payload.fundiId);
        console.log('Matched fundi response:', fundiRes);
        if (fundiRes?.fundi) {
          const f = fundiRes.fundi;
          console.log('Setting matched fundi:', f);
          setFundi({
            id: f.id,
            name: `${f.firstName} ${f.lastName}`,
            skill: f.skills?.[0] || f.locationCity || 'Fundi',
            distanceKm: payload.distanceKm ? parseFloat((payload.distanceKm).toFixed ? payload.distanceKm.toFixed(1) : `${payload.distanceKm}`) : 0,
            rating: f.rating || 4.5,
            avatarUrl: f.avatarUrl || f.avatar_url || '/assets/default-avatar.png'
          });
        }
      } catch (e) {
        console.error('Failed to fetch matched fundi', e);
      }
    });

    socket.on('job:accepted', (payload) => {
      if (!payload || payload.jobId !== jobId) return;
      setSearchFailed(false);
      setJobStatusRaw('accepted');
      if (payload.estimatedPrice != null) {
        const p = Number(payload.estimatedPrice);
        if (Number.isFinite(p)) setEstimatedPrice(p);
      }
      if (payload.fundiId) {
        (async () => {
          try {
            const fundiRes = await apiClient.getFundi(payload.fundiId);
            if (fundiRes?.fundi) {
              const f = fundiRes.fundi;
              setFundi({
                id: f.id,
                name: `${f.firstName} ${f.lastName}`,
                skill: f.skills?.[0] || f.locationCity || 'Fundi',
                distanceKm: payload.distanceKm ? Number(payload.distanceKm) : 0,
                rating: f.rating || 4.5,
                avatarUrl: f.avatarUrl || f.avatar_url || '/assets/default-avatar.png'
              });
            }
          } catch (e) {
            // ignore
          }
        })();
      }
    });

    socket.on('job:rejected', (payload) => {
      if (!payload || payload.jobId !== jobId) return;
      setJobStatusRaw('matching');
      setProgressMsg('Finding another fundi...');
    });

    socket.on('job:cancelled', (payload) => {
      if (!payload || payload.jobId !== jobId) return;
      setJobStatusRaw('cancelled');
      setProgressMsg('Job cancelled');
    });

    socket.on('job:search:failed', (payload) => {
      if (!payload || payload.jobId !== jobId) return;
      setSearchFailed(true);
      setJobStatusRaw('failed');
      setProgressMsg('No fundis found nearby. Try again in a few minutes or adjust your request.');
    });

    socket.on('fundi:location', (payload) => {
      if (!payload || payload.jobId !== jobId) return;
      setFundiLocation({ latitude: payload.latitude, longitude: payload.longitude });
    });

    socket.on('job:completed', (payload) => {
      if (!payload || payload.jobId !== jobId) return;
      setJobStatusRaw('completed');
      setPaymentMsg(payload.message || 'Job completed');
    });

    socket.on('payment:confirmed', (payload) => {
      if (!payload || payload.jobId !== jobId) return;
      setPaymentStatus('confirmed');
      setPaymentMsg('Payment confirmed. Thank you!');
    });

    // fetch job details and customer location
    (async () => {
      if (!jobId) return;
      console.log('Fetching job details for jobId=', jobId);
      try {
        const res = await apiClient.getJob(jobId);
        console.log('Job fetched:', res?.job);
        if (res?.job) {
          const job = res.job;
          setJobStatusRaw(job.status || 'searching');
          if (job.latitude && job.longitude) {
            setCustomerLocation({ latitude: parseFloat(job.latitude), longitude: parseFloat(job.longitude) });
          }
          if (job.match_radius_km != null) {
            const r = Number(job.match_radius_km);
            if (Number.isFinite(r)) setSearchRadiusKm(r);
          }
          if (job.estimatedPrice != null || job.estimated_price != null) {
            const p = Number(job.estimatedPrice ?? job.estimated_price);
            if (Number.isFinite(p)) setEstimatedPrice(p);
          }
          if (job.fundiId) {
            // fetch fundi profile
            try {
              const fRes = await apiClient.getFundi(job.fundiId);
              console.log('Fundi response:', fRes);
              if (fRes?.fundi) {
                const f = fRes.fundi;
                console.log('Setting fundi:', f);
                setFundi({
                  id: f.id,
                  name: `${f.firstName} ${f.lastName}`,
                  skill: f.skills?.[0] || f.locationCity || 'Fundi',
                  distanceKm: 0,
                  rating: f.rating || 4.5,
                  avatarUrl: f.avatarUrl || f.avatar_url || '/assets/default-avatar.png'
                });
              }
            } catch (fundiErr) {
              console.error('Failed to fetch fundi profile:', fundiErr);
            }
          }
        }
      } catch (e) {
        console.error('Failed to load job', e);
        setJobStatusRaw('failed');
      }
    })();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [jobId, hasAuth]);

  // Initialize map once (full-screen). Update markers as locations change.
  useEffect(() => {
    const el = document.getElementById('tracking-map');
    if (!el) return;

    if (!mapRef.current) {
      const lat = customerLocation?.latitude || -1.286389;
      const lng = customerLocation?.longitude || 36.817223;

      const map = L.map('tracking-map', {
        zoomControl: false,
        attributionControl: false,
      }).setView([lat, lng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      customerMarkerRef.current = L.marker([lat, lng], {
        title: 'Your location',
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
      }).addTo(map);

      // Fix: Leaflet often renders tiles with the initial (wrong) container size.
      // Invalidate size after layout settles so tiles fill the full screen.
      const invalidate = () => {
        try {
          map.invalidateSize(true);
        } catch (e) {
          // ignore
        }
      };
      requestAnimationFrame(invalidate);
      window.setTimeout(invalidate, 120);
      window.setTimeout(invalidate, 420);

      const onResize = () => invalidate();
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);
      (map as any)._fixit_onResize = onResize;

      // Also invalidate whenever the container size changes (flex layout / bottom panel height, etc.)
      try {
        const ro = new ResizeObserver(() => invalidate());
        ro.observe(el);
        resizeObserverRef.current = ro;
      } catch (e) {
        // ResizeObserver not available; window resize handler above is the fallback.
      }
    }

    return () => {
      // stop any searching pulse timer
      if (searchPulseTimerRef.current) {
        window.clearInterval(searchPulseTimerRef.current);
        searchPulseTimerRef.current = null;
      }

      const map = mapRef.current as any;
      if (map?._fixit_onResize) {
        window.removeEventListener('resize', map._fixit_onResize);
        window.removeEventListener('orientationchange', map._fixit_onResize);
      }
      if (resizeObserverRef.current) {
        try {
          resizeObserverRef.current.disconnect();
        } catch (e) {
          // ignore
        }
        resizeObserverRef.current = null;
      }
      mapRef.current?.remove();
      mapRef.current = null;
      customerMarkerRef.current = null;
      fundiMarkerRef.current = null;
      searchCircleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const cLat = customerLocation?.latitude || -1.286389;
    const cLng = customerLocation?.longitude || 36.817223;
    customerMarkerRef.current?.setLatLng([cLat, cLng]);

    // When we first learn the customer's GPS, ensure the map recenters and tiles fully render.
    if (status === 'searching' && customerLocation?.latitude && customerLocation?.longitude) {
      try {
        map.setView([cLat, cLng], 15, { animate: true });
        map.invalidateSize(true);
      } catch (e) {
        // ignore
      }
    }

    // Searching ring (Uber-ish scanning feel)
    const shouldShowSearch = status === 'searching';
    if (shouldShowSearch) {
      if (!searchCircleRef.current) {
        searchCircleRef.current = L.circle([cLat, cLng], {
          radius: 900,
          color: '#60a5fa',
          weight: 1,
          fillColor: '#3b82f6',
          fillOpacity: 0.10,
        }).addTo(map);
      } else {
        searchCircleRef.current.setLatLng([cLat, cLng]);
      }

      // Simple pulse (no heavy animation libs): gently expand/contract the search radius.
      if (!searchPulseTimerRef.current) {
        let dir = 1;
        let r = 900;
        searchPulseTimerRef.current = window.setInterval(() => {
          if (!searchCircleRef.current) return;
          r += dir * 80;
          if (r >= 1150) dir = -1;
          if (r <= 780) dir = 1;
          searchCircleRef.current.setRadius(r);
        }, 350);
      }
    } else if (searchCircleRef.current) {
      searchCircleRef.current.remove();
      searchCircleRef.current = null;
      if (searchPulseTimerRef.current) {
        window.clearInterval(searchPulseTimerRef.current);
        searchPulseTimerRef.current = null;
      }
    }

    if (fundiLocation?.latitude && fundiLocation?.longitude) {
      const fLat = parseFloat(String(fundiLocation.latitude));
      const fLng = parseFloat(String(fundiLocation.longitude));
      if (!Number.isNaN(fLat) && !Number.isNaN(fLng)) {
        if (!fundiMarkerRef.current) {
          fundiMarkerRef.current = L.marker([fLat, fLng], {
            title: 'Fundi location',
            icon: L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            }),
          }).addTo(map);
        } else {
          fundiMarkerRef.current.setLatLng([fLat, fLng]);
        }

        const bounds = L.latLngBounds([
          [cLat, cLng],
          [fLat, fLng],
        ]);
        map.fitBounds(bounds, { padding: [70, 70] });
      }
    } else {
      // If no fundi yet, keep map centered on the customer.
      if (status === 'searching') map.setView([cLat, cLng], 15, { animate: true });
    }
  }, [status, customerLocation, fundiLocation]);

  const handleRetry = () => {
    setJobStatusRaw('matching');
    setProgressMsg('Finding nearby fundi...');
    setFundi(null);
    setEta(null);
  };

  const phoneLink = fundi ? `tel:+254700000000` : '#';

  console.log('FundiTracker: rendering with status=', status, 'rawStatus=', jobStatusRaw, 'fundi=', fundi, 'jobId=', jobId);

  // Safety check: if no jobId, show error
  if (!jobId) {
    return (
      <div className="fundi-tracker root-status-failed">
        <div className="status-screen">
          <div className="status-center">
            <div className="failed-block">
              <p className="status-text">No job ID provided</p>
              <div className="actions">
                <Button onClick={() => window.location.href = '/dashboard'}>Go to Dashboard</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Safety check: if no auth, redirect to login
  if (!hasAuth) {
    return (
      <div className="fundi-tracker root-status-failed">
        <div className="status-screen">
          <div className="status-center">
            <div className="failed-block">
              <p className="status-text">Please sign in to track your fundi</p>
              <div className="actions">
                <Button onClick={() => window.location.href = '/auth'}>Sign In</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const panelContent = (() => {
    if (status === 'searching') {
      return (
        <>
          <div className="sheet-title">Searching nearby fundis</div>
          <div className="sheet-sub">{progressMsg || 'Notifying verified fundis around you'}</div>
          {(searchRadiusKm || estimatedPrice) && (
            <div className="sheet-sub" style={{ marginTop: 8 }}>
              {searchRadiusKm ? `Search radius: ${searchRadiusKm} km` : null}
              {searchRadiusKm && estimatedPrice ? ' • ' : null}
              {estimatedPrice ? `Est. price: KES ${Math.round(estimatedPrice)}` : null}
            </div>
          )}
          <div className="sheet-row">
            <div className="pulse-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="status-pill">MATCHING</div>
          </div>
          <div className="sheet-row" style={{ marginTop: 10 }}>
            <div className="sheet-sub" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <ShieldCheck size={16} />
              Only approved, subscription-active fundis are notified.
            </div>
          </div>

          <div className="actions large-actions large-actions-top">
            <button
              className="action-btn call"
              onClick={async () => {
                try {
                  await apiClient.cancelJob(jobId!, 'Customer cancelled while searching');
                  setJobStatusRaw('cancelled');
                  toast.success('Job cancelled');
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to cancel job');
                }
              }}
            >
              <X size={20} />
              <span>Cancel</span>
            </button>
            <button
              className="action-btn message"
              onClick={() => {
                if (!mapRef.current) return;
                const lat = customerLocation?.latitude || -1.286389;
                const lng = customerLocation?.longitude || 36.817223;
                mapRef.current.setView([lat, lng], 15, { animate: true });
                try { mapRef.current.invalidateSize(true); } catch (e) {}
              }}
            >
              <Navigation size={20} />
              <span>Center</span>
            </button>
          </div>

          <div className="actions large-actions" style={{ marginTop: 10 }}>
            <a className="action-btn message" href="/dashboard" style={{ flex: "1 1 100%" }}>
              <Wrench size={20} />
              <span>Dashboard</span>
            </a>
          </div>
        </>
      );
    }

    if (status === 'failed') {
      return (
        <>
          <div className="sheet-title">{searchFailed ? 'No fundi found' : 'Could not load tracking'}</div>
          <div className="sheet-sub">
            {progressMsg || (searchFailed ? 'No available fundis in your area right now.' : 'Please check your connection and try again.')}
          </div>
          <div className="actions large-actions">
            <a className="action-btn message" href="/create-job">New job</a>
            <a className="action-btn call" href="/dashboard">Dashboard</a>
          </div>
        </>
      );
    }

    if (status === 'cancelled') {
      return (
        <>
          <div className="sheet-title">Job cancelled</div>
          <div className="sheet-sub">You can create a new request anytime.</div>
          <div className="actions large-actions">
            <a className="action-btn message" href="/create-job">New job</a>
            <a className="action-btn call" href="/dashboard">Dashboard</a>
          </div>
        </>
      );
    }

    if (status === 'completed') {
      return (
        <>
          <div className="sheet-title">Job completed</div>
          <div className="sheet-sub">{paymentMsg || 'Confirm completion and pay to release funds.'}</div>

          {!completionConfirmed ? (
            <div style={{ marginTop: 12 }}>
              <div className="sheet-sub">Enter the 6-digit OTP sent to your email</div>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
                <InputOTP maxLength={6} value={completionOtp} onChange={(v) => setCompletionOtp(v)}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div style={{ marginTop: 12 }}>
                <Button
                  onClick={async () => {
                    try {
                      await apiClient.confirmJobCompletion(jobId!, completionOtp);
                      setCompletionConfirmed(true);
                      setPaymentMsg('Completion confirmed. You can now pay.');
                    } catch (e: any) {
                      setPaymentMsg(e?.message || 'OTP verification failed');
                    }
                  }}
                  disabled={completionOtp.trim().length !== 6}
                  className="w-full"
                >
                  Confirm Completion
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div className="sheet-sub">M-Pesa number</div>
              <input
                value={mpesaNumber}
                onChange={(e) => setMpesaNumber(e.target.value)}
                placeholder="0712345678"
                className="w-full h-11 px-3 rounded-lg border border-white/10 bg-black/20 text-white outline-none"
                style={{ marginTop: 8 }}
              />
              <div style={{ marginTop: 10 }}>
                <Button
                  onClick={async () => {
                    try {
                      setPaymentStatus('processing');
                      const res = await apiClient.processPayment(jobId!, 'mpesa', mpesaNumber || null);
                      setPaymentStatus('initiated');
                      setPaymentMsg(res?.message || 'Payment initiated. Check your phone.');
                    } catch (e: any) {
                      setPaymentStatus('failed');
                      setPaymentMsg(e?.message || 'Payment failed');
                    }
                  }}
                  disabled={paymentStatus === 'processing' || paymentStatus === 'confirmed'}
                  className="w-full"
                >
                  {paymentStatus === 'processing' ? 'Processing...' : paymentStatus === 'confirmed' ? 'Paid' : 'Pay Now'}
                </Button>
              </div>
              <div style={{ marginTop: 10 }}>
                <Button variant="outline" onClick={() => onComplete?.()} disabled={paymentStatus !== 'confirmed'} className="w-full">
                  Done
                </Button>
              </div>
            </div>
          )}
        </>
      );
    }

    if (['matched', 'accepted', 'on_the_way', 'arrived', 'in_progress'].includes(status)) {
      if (!fundi) {
        return (
          <>
            <div className="sheet-title">Fundi assigned</div>
            <div className="sheet-sub">Loading fundi profile...</div>
          </>
        );
      }

      return (
        <>
          <div className="sheet-title">{status === 'matched' ? 'Fundi found' : `${fundi.name}`}</div>
          <div className="sheet-sub">
            {status === 'matched' && 'Waiting for them to accept'}
            {status === 'accepted' && 'They accepted your request'}
            {status === 'on_the_way' && 'Heading to your location'}
            {status === 'arrived' && 'Fundi has arrived'}
            {status === 'in_progress' && 'Work in progress'}
          </div>

          <div className="sheet-row">
            <div className="status-pill">{status.replace(/_/g, ' ').toUpperCase()}</div>
            <div className="eta">{eta ? `ETA ${eta} min` : ''}</div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="fundi-card slide-up">
              <img
                src={fundi.avatarUrl}
                alt={fundi.name}
                className="avatar"
                onError={(e) => { (e.target as HTMLImageElement).src = '/assets/default-avatar.png'; }}
              />
              <div className="meta">
                <div className="name">{fundi.name}</div>
                <div className="skill">{fundi.skill}</div>
                <div className="details">{fundi.distanceKm ? `${fundi.distanceKm} km` : ''} • {fundi.rating} ★</div>
              </div>
            </div>
          </div>

          <div className="actions large-actions">
            <a href={phoneLink} className="action-btn call" aria-label="Call Fundi">
              <Phone size={20} />
              <span>Call</span>
            </a>
            <button
              className="action-btn message"
              onClick={() => toast.message('Chat is enabled in realtime API; UI wiring is next.')}
            >
              <MessageCircle size={20} />
              <span>Chat</span>
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="sheet-title">Working on it...</div>
        <div className="sheet-sub">Status: {status}</div>
      </>
    );
  })();

  return (
    <div className={`fundi-tracker root-status-${status}`}>
      <div className="tracking-shell">
        <div className="tracking-map">
          <div id="tracking-map" />

          <div className="tracking-overlay">
            <div className="tracking-topbar">
              <div className="top-chip">
                <div className="dot" />
                <div className="label">
                  {status === 'searching' && 'Finding a Fundi'}
                  {status === 'matched' && 'Fundi Matched'}
                  {status === 'accepted' && 'Fundi Accepted'}
                  {status === 'on_the_way' && 'On the Way'}
                  {status === 'arrived' && 'Arrived'}
                  {status === 'in_progress' && 'In Progress'}
                  {status === 'completed' && 'Completed'}
                  {status === 'cancelled' && 'Cancelled'}
                  {status === 'failed' && 'Connection Issue'}
                </div>
              </div>

              <div className="top-actions">
                {status === 'searching' && (
                  <button
                    className="icon-btn"
                    aria-label="Cancel job"
                    onClick={async () => {
                      try {
                        await apiClient.cancelJob(jobId!, 'Customer cancelled while searching');
                        setJobStatusRaw('cancelled');
                        toast.success('Job cancelled');
                      } catch (e: any) {
                        toast.error(e?.message || 'Failed to cancel job');
                      }
                    }}
                  >
                    <X size={18} />
                  </button>
                )}
                <button
                  className="icon-btn"
                  aria-label="Center map"
                  onClick={() => {
                    if (!mapRef.current) return;
                    const lat = customerLocation?.latitude || -1.286389;
                    const lng = customerLocation?.longitude || 36.817223;
                    mapRef.current.setView([lat, lng], 15, { animate: true });
                    try { mapRef.current.invalidateSize(true); } catch (e) {}
                  }}
                >
                  <Navigation size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="tracking-panel">
          <div className="bottom-sheet">
            <div className="sheet-handle" />
            {panelContent}
          </div>
        </div>
      </div>
    </div>
  );
}
