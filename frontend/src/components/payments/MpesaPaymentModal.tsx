import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert, AlertDescription } from '../../components/ui/alert';

interface PaymentModalProps {
  jobId: string;
  amount: number;
  fundiName: string;
  onPaymentSuccess?: () => void;
  onClose?: () => void;
}

export const MpesaPaymentModal: React.FC<PaymentModalProps> = ({
  jobId,
  amount,
  fundiName,
  onPaymentSuccess,
  onClose,
}) => {
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stage, setStage] = useState<'input' | 'processing' | 'success' | 'error'>('input');
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Format phone number as Kenyan
  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('254') && cleaned.length >= 12) return cleaned;
    if (cleaned.startsWith('7') && cleaned.length === 9) return `254${cleaned}`;
    if (cleaned.startsWith('01') && cleaned.length === 10) return `254${cleaned.slice(1)}`;
    return `254${cleaned}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mpesaNumber.trim()) {
      setError('Please enter your M-Pesa number');
      return;
    }

    setIsProcessing(true);
    setStage('processing');
    setError(null);

    try {
      const formattedPhone = formatPhoneNumber(mpesaNumber);

      const response = await fetch(`/api/payments/process/${jobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          paymentMethod: 'mpesa',
          mpesaNumber: formattedPhone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Payment initiation failed');
      }

      setTransactionId(data.payment?.transactionId);
      setStage('success');

      // Call success callback
      if (onPaymentSuccess) {
        setTimeout(onPaymentSuccess, 2000);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed');
      setStage('error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold">Pay with M-Pesa</h2>
            <p className="text-sm text-gray-600">Complete payment for {fundiName}</p>
          </div>
          {onClose && !isProcessing && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>

        {/* Input Stage */}
        {stage === 'input' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount */}
            <div>
              <Label className="text-base">Amount to Pay</Label>
              <div className="text-3xl font-bold text-blue-600 mt-1">
                KES {amount.toLocaleString()}
              </div>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-sm text-blue-900">
                📱 You will receive an M-Pesa prompt on your phone after submitting your number below.
              </p>
            </div>

            {/* Phone Input */}
            <div>
              <Label htmlFor="mpesa-number">M-Pesa Number *</Label>
              <Input
                id="mpesa-number"
                type="tel"
                value={mpesaNumber}
                onChange={(e) => setMpesaNumber(e.target.value)}
                placeholder="e.g., 0712345678 or 254712345678"
                disabled={isProcessing}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter your M-Pesa registered phone number
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isProcessing || !mpesaNumber.trim()}
              className="w-full"
              size="lg"
            >
              {isProcessing ? 'Initiating Payment...' : 'Initiate M-Pesa Payment'}
            </Button>

            {/* Cancel Button */}
            {onClose && (
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isProcessing}
                className="w-full"
              >
                Cancel
              </Button>
            )}
          </form>
        )}

        {/* Processing Stage */}
        {stage === 'processing' && (
          <div className="text-center space-y-4 py-6">
            <div className="animate-spin text-4xl">⏳</div>
            <div>
              <p className="text-lg font-semibold">Processing Payment</p>
              <p className="text-sm text-gray-600">
                Check your phone for the M-Pesa prompt...
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded text-sm">
              <p className="font-semibold">Amount: KES {amount.toLocaleString()}</p>
              <p className="text-gray-600">Number: {mpesaNumber}</p>
            </div>
            <p className="text-xs text-gray-500">
              Do not close this window. Enter your M-Pesa PIN when prompted.
            </p>
          </div>
        )}

        {/* Success Stage */}
        {stage === 'success' && (
          <div className="text-center space-y-4 py-6">
            <div className="text-6xl">✅</div>
            <div>
              <p className="text-lg font-semibold text-green-600">Payment Initiated!</p>
              <p className="text-sm text-gray-600">
                Check your phone to complete the payment
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded text-sm">
              <p className="font-semibold">Amount: KES {amount.toLocaleString()}</p>
              <p className="text-gray-600">Fundi: {fundiName}</p>
              {transactionId && (
                <p className="text-xs text-gray-500 mt-2">
                  Transaction ID: {transactionId}
                </p>
              )}
            </div>
            <p className="text-xs text-gray-500">
              You will be redirected shortly...
            </p>
          </div>
        )}

        {/* Error Stage */}
        {stage === 'error' && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>

            <div className="bg-red-50 p-3 rounded text-sm text-red-900">
              <p className="font-semibold mb-2">Troubleshooting:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Verify your M-Pesa number is correct</li>
                <li>Ensure you have M-Pesa balance</li>
                <li>Check your phone connection</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setStage('input');
                  setError(null);
                  setMpesaNumber('');
                }}
                className="flex-1"
              >
                Try Again
              </Button>
              {onClose && (
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MpesaPaymentModal;
