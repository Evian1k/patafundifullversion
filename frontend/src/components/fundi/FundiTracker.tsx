import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, MessageCircle, MapPin, Clock, Star } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '@/lib/api';
import './fundi-tracker.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  | 'in_progress'
  | 'completed'
  | 'failed';

export default function FundiTracker({
  onComplete,
  jobId,
}: {
  onComplete?: () => void;
  jobId?: string;
}) {
  const [status, setStatus] = useState<Status>('searching');
  const [fundi, setFundi] = useState<FundiInfo | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [progressMsg, setProgressMsg] = useState('Finding nearby fundi...');
  const blockBackRef = useRef<boolean>(false);
  const socketRef = useRef<Socket | null>(null);
  const [customerLocation, setCustomerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [fundiLocation, setFundiLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasAuth, setHasAuth] = useState<boolean>(true);

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

    blockBackRef.current = status === 'searching' || status === 'matched';

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
      setStatus('failed');
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
      setStatus('failed');
    });
    
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setStatus('failed');
    });

    socket.on('job:matched', async (payload) => {
      console.log('Received job:matched', payload);
      if (!payload || payload.jobId !== jobId) return;
      setStatus('matched');
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
      setStatus('accepted');
    });

    socket.on('job:rejected', (payload) => {
      if (!payload || payload.jobId !== jobId) return;
      setStatus('searching');
    });

    socket.on('fundi:location', (payload) => {
      if (!payload || payload.jobId !== jobId) return;
      setFundiLocation({ latitude: payload.latitude, longitude: payload.longitude });
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
          setStatus(job.status as Status);
          if (job.latitude && job.longitude) {
            setCustomerLocation({ latitude: parseFloat(job.latitude), longitude: parseFloat(job.longitude) });
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
        setStatus('failed');
      }
    })();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [jobId, hasAuth]);

  // Initialize and manage map
  useEffect(() => {
    if (!['on_the_way', 'in_progress'].includes(status)) {
      return;
    }

    const mapEl = document.getElementById('tracking-map');
    if (!mapEl) {
      console.warn('Map element not found');
      return;
    }

    // Check if map already exists
    const mapElement = mapEl as unknown as Record<string, unknown>;
    if (mapElement._leaflet_id) {
      console.log('Map already initialized');
      return;
    }

    try {
      // Initialize map with customer location or default
      const lat = customerLocation?.latitude || -1.286389;
      const lng = customerLocation?.longitude || 36.817223;
      
      const map = L.map('tracking-map').setView([lat, lng], 15);
      
      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add customer location marker
      L.marker([lat, lng], {
        title: 'Your location',
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(map).bindPopup('Your location');

      // Add fundi location marker if available
      if (fundiLocation) {
        L.marker([fundiLocation.latitude, fundiLocation.longitude], {
          title: 'Fundi location',
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        }).addTo(map).bindPopup('Fundi location');

        // Fit map to both markers
        const bounds = L.latLngBounds([
          [lat, lng],
          [fundiLocation.latitude, fundiLocation.longitude]
        ]);
        map.fitBounds(bounds, { padding: [50, 50] });
      }

      console.log('Map initialized successfully');

      // Cleanup
      return () => {
        map.remove();
      };
    } catch (error) {
      console.error('Failed to initialize map:', error);
    }
  }, [status, customerLocation, fundiLocation]);

  const handleRetry = () => {
    setStatus('searching');
    setFundi(null);
    setEta(null);
  };

  const phoneLink = fundi ? `tel:+254700000000` : '#';

  console.log('FundiTracker: rendering with status=', status, 'fundi=', fundi, 'jobId=', jobId);

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

  return (
    <div className={`fundi-tracker root-status-${status}`}>
      {/* Full-screen status view */}
      <div className="status-screen">
        <div className="status-center">
          {['searching', 'requested'].includes(status) && (
            <div className="searching-block">
              <div className="ripple-map">
                <div className="pin" />
                <div className="ripple" />
                <div className="ripple delay" />
              </div>
              <p className="status-text">{progressMsg}</p>
            </div>
          )}

          {status === 'failed' && (
            <div className="failed-block">
              <p className="status-text">Could not load job details</p>
              <p className="status-small">Please check your connection and try again</p>
              <div className="actions">
                <Button onClick={handleRetry}>Retry</Button>
                <Button onClick={() => window.location.href = '/dashboard'} variant="outline">Go to Dashboard</Button>
              </div>
            </div>
          )}

          {['matched', 'accepted'].includes(status) && fundi && (
            <div className="found-block">
              <p className="status-small">{status === 'matched' ? 'Fundi matched — awaiting their response' : 'Fundi accepted your request'}</p>
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
              <div className="actions large-actions large-actions-top">
                <a href={`tel:+254700000000`} className="action-btn call" aria-label="Call Fundi">
                  <Phone size={20} />
                  <span>Call</span>
                </a>
                <button className="action-btn message" onClick={() => alert('Chat feature coming soon')}>
                  <MessageCircle size={20} />
                  <span>Message</span>
                </button>
              </div>
            </div>
          )}

          {['on_the_way','in_progress'].includes(status) && fundi && (
            <div className="live-block">
              <p className="status-small">{status === 'on_the_way' ? 'Fundi is on the way' : 'Job in progress'}</p>
              <div id="tracking-map" className="map-placeholder"></div>
              <div className="eta-row">
                <div className="eta">ETA: {eta ? `${eta} min` : 'Calculating...'}</div>
                <div className="status-pill">{status.replace(/_/g, ' ').toUpperCase()}</div>
              </div>
              <div className="actions large-actions">
                <a href={`tel:+254700000000`} className="action-btn call" aria-label="Call Fundi">
                  <Phone size={20} />
                  <span>Call</span>
                </a>
                <button className="action-btn message" onClick={() => alert('Chat feature coming soon')}>
                  <MessageCircle size={20} />
                  <span>Message</span>
                </button>
              </div>
            </div>
          )}

          {status === 'completed' && (
            <div className="complete-block">
              <p className="status-text">Completed — thank you!</p>
              <div className="actions">
                <Button onClick={() => onComplete?.()}>Done</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
