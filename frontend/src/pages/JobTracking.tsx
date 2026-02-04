import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FundiTracker from '@/components/fundi/FundiTracker';

export default function JobTracking() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <FundiTracker jobId={jobId} onComplete={() => navigate('/dashboard')} />
    </div>
  );
}
