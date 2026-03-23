import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert';

interface PaymentRecord {
  id: string;
  jobId: string;
  amount: number;
  platformFee: number;
  fundiEarnings: number;
  paymentMethod: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  transactionId: string;
  createdAt: string;
}

interface PaymentStatusProps {
  jobId: string;
  onStatusChange?: (status: string) => void;
}

export const PaymentStatus: React.FC<PaymentStatusProps> = ({
  jobId,
  onStatusChange,
}) => {
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch payment status
  const fetchPaymentStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/payments/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setPayment(null);
        } else {
          setError(data.message || 'Failed to load payment status');
        }
      } else if (data.success) {
        setPayment(data.payment);
        if (onStatusChange) {
          onStatusChange(data.payment.status);
        }
      }
    } catch (err) {
      console.error('Error fetching payment:', err);
      setError('Unable to load payment status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentStatus();

    // Poll for status updates every 5 seconds if payment is processing
    const interval = setInterval(() => {
      if (payment?.status === 'processing') {
        fetchPaymentStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobId, payment?.status]);

  if (loading) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600">Loading payment status...</p>
      </div>
    );
  }

  if (!payment) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200 text-green-900';
      case 'processing':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      case 'pending':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'failed':
      case 'cancelled':
        return 'bg-red-50 border-red-200 text-red-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'processing':
        return '⏳';
      case 'pending':
        return '⏸️';
      case 'failed':
      case 'cancelled':
        return '❌';
      default:
        return 'ℹ️';
    }
  };

  const statusColor = getStatusColor(payment.status);
  const statusIcon = getStatusIcon(payment.status);

  return (
    <div className="space-y-4">
      <Alert className={`border ${statusColor}`}>
        <AlertDescription className="flex items-start gap-3">
          <span className="text-2xl">{statusIcon}</span>
          <div>
            <div className="font-semibold capitalize">
              Payment {payment.status === 'pending' ? 'Pending' : payment.status}
            </div>
            <div className="text-sm mt-1">
              {payment.status === 'pending' && 'Waiting for payment to be initiated'}
              {payment.status === 'processing' && 'Payment is being processed. Check your M-Pesa for a prompt.'}
              {payment.status === 'completed' && 'Payment has been successfully completed'}
              {(payment.status === 'failed' || payment.status === 'cancelled') && 'Payment could not be completed'}
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Payment Details */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div>
          <h4 className="font-semibold text-sm mb-3">Payment Details</h4>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Service Amount:</span>
            <span className="font-medium">KES {payment.amount.toLocaleString()}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600">Platform Fee:</span>
            <span className="font-medium">KES {payment.platformFee.toLocaleString()}</span>
          </div>

          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Fundi Receives:</span>
            <span className="text-green-600">KES {payment.fundiEarnings.toLocaleString()}</span>
          </div>
        </div>

        {payment.paymentMethod && (
          <div className="text-xs text-gray-600 pt-2 border-t">
            <div>Payment Method: <span className="capitalize font-medium">{payment.paymentMethod}</span></div>
          </div>
        )}

        {payment.transactionId && (
          <div className="text-xs text-gray-600 pt-2 border-t">
            <div>Transaction ID: <span className="font-mono">{payment.transactionId}</span></div>
          </div>
        )}

        {payment.createdAt && (
          <div className="text-xs text-gray-600 pt-2 border-t">
            <div>Created: {new Date(payment.createdAt).toLocaleDateString()} {new Date(payment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default PaymentStatus;
