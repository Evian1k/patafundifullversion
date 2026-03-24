# Maps & Payments Integration Guide

This guide shows how to integrate the new Google Maps and M-Pesa payment features into your app.

## Table of Contents

1. [Setup](#setup)
2. [Google Maps Components](#google-maps-components)
3. [M-Pesa Payment Components](#mpesa-payment-components)
4. [Backend API Endpoints](#backend-api-endpoints)
5. [Example Usage](#example-usage)
6. [Environment Variables](#environment-variables)

## Setup

### 1. Install Dependencies

Google Maps and related packages are already installed. Ensure your environment variables are configured.

### 2. Create `.env` File

Add the following to your `.env` file:

```env
# Google Maps API
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# M-Pesa Configuration (Daraja API)
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=your_business_shortcode
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://yourapp.com/api/payments/mpesa/callback
MPESA_ENV=sandbox  # or 'live' for production

# Frontend
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### 3. Update Database (if needed)

The database schema already includes:
- `fundi_profiles` table with `latitude`, `longitude`, `location_address`, `location_city`, `location_area`
- `jobs` table with `latitude`, `longitude`, `location`
- `payments` and `mpesa_transactions` tables

## Google Maps Components

### 1. LocationPicker Component

Use this to let users search and select an address.

```tsx
import { LocationPicker } from '@/components/maps';

function MyComponent() {
  const handleSelectLocation = (location) => {
    console.log('Selected:', location);
    // location = { address, latitude, longitude, placeId }
  };

  return (
    <LocationPicker
      onSelectLocation={handleSelectLocation}
      placeholder="Search for an address..."
    />
  );
}
```

**Props:**
- `onSelectLocation`: Callback when location is selected
- `defaultValue`: Pre-fill with an address
- `placeholder`: Input placeholder text
- `className`: CSS classes for styling

### 2. LocationEditor Component

Full location editor with map preview for fundi profiles.

```tsx
import { LocationEditor } from '@/components/maps';

function FundiLocationSetup() {
  const handleSaveLocation = async (location) => {
    // Make API call to save location
    const response = await fetch('/api/fundi/update-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(location),
    });
    // Handle response...
  };

  return (
    <LocationEditor
      onSaveLocation={handleSaveLocation}
      currentLocation={{
        address: 'Nairobi, Kenya',
        city: 'Nairobi',
        area: 'Westlands',
        latitude: -1.2832,
        longitude: 36.8172,
      }}
    />
  );
}
```

**Props:**
- `onSaveLocation`: Async callback to save location
- `currentLocation`: Initial location to display
- `loading`: Show loading state

### 3. NearbyFundisMap Component

Display nearby fundis on a Google Map with list view.

```tsx
import { NearbyFundisMap } from '@/components/maps';

function FindFundis() {
  const [customerLat] = useState(-1.2832); // Nairobi
  const [customerLng] = useState(36.8172);

  const handleSelectFundi = (fundi) => {
    console.log('Selected fundi:', fundi);
    // Proceed with job creation or booking
  };

  return (
    <NearbyFundisMap
      latitude={customerLat}
      longitude={customerLng}
      radius={10}  // Search within 10 km
      category="Plumbing"  // Optional filter
      onSelectFundi={handleSelectFundi}
      height="500px"
    />
  );
}
```

**Props:**
- `latitude`: Customer's latitude coordinate
- `longitude`: Customer's longitude coordinate
- `radius`: Search radius in kilometers (default: 10)
- `category`: Optional service category filter
- `onSelectFundi`: Callback when fundi is selected
- `height`: Map container height (default: 400px)

**Fundi Object Structure:**
```typescript
{
  userId: string;
  name: string;
  phone: string;
  skills: string[];
  location: {
    city: string;
    area: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  experience: number;
  rating: { avg: number; count: number };
  distanceKm: number;
  subscriptionActive: boolean;
  verified: boolean;
}
```

## M-Pesa Payment Components

### 1. MpesaPaymentModal Component

Complete M-Pesa payment flow with STK push.

```tsx
import { MpesaPaymentModal } from '@/components/payments';

function JobCompletion() {
  const [showPayment, setShowPayment] = useState(false);
  const jobId = 'job-123';
  const finalAmount = 5000; // KES
  const fundiName = 'John Mwangi';

  const handlePaymentSuccess = () => {
    // Payment initiated successfully
    console.log('Payment initiated!');
    // Refresh job status or redirect
  };

  return (
    <>
      <button onClick={() => setShowPayment(true)}>
        Pay Fundi - KES {finalAmount}
      </button>

      {showPayment && (
        <MpesaPaymentModal
          jobId={jobId}
          amount={finalAmount}
          fundiName={fundiName}
          onPaymentSuccess={handlePaymentSuccess}
          onClose={() => setShowPayment(false)}
        />
      )}
    </>
  );
}
```

**Props:**
- `jobId`: The job ID to process payment for
- `amount`: Amount in KES to charge
- `fundiName`: Name of the fundi (for display)
- `onPaymentSuccess`: Callback when payment is initiated
- `onClose`: Callback to close the modal

**Payment Flow:**
1. User enters M-Pesa number
2. Backend initiates STK push via Daraja API
3. User receives M-Pesa prompt on their phone
4. User enters PIN to complete payment
5. Callback updates payment status in database

### 2. PaymentStatus Component

Display payment status and details.

```tsx
import { PaymentStatus } from '@/components/payments';

function JobDetails() {
  const jobId = 'job-123';

  const handleStatusChange = (newStatus) => {
    console.log('Payment status changed to:', newStatus);
  };

  return (
    <PaymentStatus
      jobId={jobId}
      onStatusChange={handleStatusChange}
    />
  );
}
```

**Props:**
- `jobId`: The job ID to fetch payment status for
- `onStatusChange`: Callback when payment status changes

**Payment Statuses:**
- `pending`: Payment hasn't been initiated
- `processing`: STK push sent, waiting for user confirmation
- `completed`: Payment successful
- `failed`: Payment failed
- `cancelled`: Payment was cancelled

## Backend API Endpoints

### Maps Endpoints

All maps endpoints are available at `/api/maps/`

#### Geocode Address
```bash
POST /api/maps/geocode
Content-Type: application/json

{
  "address": "Nairobi, Kenya"
}

Response:
{
  "success": true,
  "data": {
    "address": "Nairobi, Kenya",
    "latitude": -1.2832,
    "longitude": 36.8172,
    "placeId": "ChIJJRgh",
    "components": [...]
  }
}
```

#### Reverse Geocode (Coordinates to Address)
```bash
POST /api/maps/reverse-geocode
Content-Type: application/json

{
  "latitude": -1.2832,
  "longitude": 36.8172
}

Response:
{
  "success": true,
  "data": {
    "address": "Nairobi, Kenya",
    "placeId": "ChIJJRgh",
    "components": [...]
  }
}
```

#### Get Place Predictions
```bash
GET /api/maps/place-predictions?input=Nairobi&lat=-1.2832&lng=36.8172&radius=50000

Response:
{
  "success": true,
  "predictions": [
    {
      "place_id": "ChIJ...",
      "main_text": "Nairobi",
      "secondary_text": "Kenya",
      "description": "Nairobi, Kenya"
    },
    ...
  ]
}
```

#### Get Place Details
```bash
GET /api/maps/place-details/:placeId

Response:
{
  "success": true,
  "data": {
    "address": "Nairobi, Kenya",
    "latitude": -1.2832,
    "longitude": 36.8172,
    "components": [...]
  }
}
```

#### Find Nearby Fundis
```bash
GET /api/maps/nearby-fundis?latitude=-1.2832&longitude=36.8172&radius=10&category=Plumbing&limit=20

Response:
{
  "success": true,
  "center": { "latitude": -1.2832, "longitude": 36.8172 },
  "radius": 10,
  "count": 5,
  "fundis": [
    {
      "userId": "user-123",
      "name": "John Mwangi",
      "phone": "0712345678",
      "skills": ["Plumbing"],
      "location": {
        "city": "Nairobi",
        "area": "Westlands",
        "address": "...",
        "latitude": -1.2832,
        "longitude": 36.8172
      },
      "experience": 5,
      "rating": { "avg": 4.8, "count": 45 },
      "distanceKm": 2.5,
      "subscriptionActive": true,
      "verified": true
    },
    ...
  ]
}
```

#### Calculate Distance
```bash
POST /api/maps/distance
Content-Type: application/json

{
  "origin": { "latitude": -1.2832, "longitude": 36.8172 },
  "destination": { "latitude": -1.3000, "longitude": 36.8300 }
}

Response:
{
  "success": true,
  "distance": 2.5,
  "unit": "km"
}
```

### Payments Endpoints

#### Process Job Payment
```bash
POST /api/payments/process/:jobId
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "paymentMethod": "mpesa",
  "mpesaNumber": "254712345678"
}

Response:
{
  "success": true,
  "message": "M-Pesa STK push initiated",
  "mpesa": {
    "merchantRequestId": "...",
    "checkoutRequestId": "...",
    "responseCode": "0",
    "responseDescription": "Success",
    "customerMessage": "..."
  },
  "payment": {
    "id": "...",
    "status": "processing",
    "amount": 5000,
    "fundiEarnings": 4500,
    "transactionId": "..."
  }
}
```

#### Get Job Payment
```bash
GET /api/payments/job/:jobId
Authorization: Bearer YOUR_TOKEN

Response:
{
  "success": true,
  "payment": {
    "id": "...",
    "jobId": "...",
    "amount": 5000,
    "platformFee": 500,
    "fundiEarnings": 4500,
    "paymentMethod": "mpesa",
    "status": "completed",
    "transactionId": "...",
    "createdAt": "2024-03-23T10:30:00Z"
  }
}
```

#### M-Pesa Callback
```bash
POST /api/payments/mpesa/callback
Content-Type: application/json

# Automatically handled by Daraja API
# No action needed - payment status updates automatically
```

## Example Usage

### Complete Customer Job Flow with Maps and Payment

```tsx
import React, { useState } from 'react';
import { NearbyFundisMap, LocationPicker } from '@/components/maps';
import { MpesaPaymentModal, PaymentStatus } from '@/components/payments';

export function CompleteJobFlow() {
  const [stage, setStage] = useState<'location' | 'fundis' | 'payment' | 'done'>('location');
  const [customerLocation, setCustomerLocation] = useState(null);
  const [selectedFundi, setSelectedFundi] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [jobAmount, setJobAmount] = useState(0);

  // Stage 1: Customer picks location
  const handleLocationSelect = (location) => {
    setCustomerLocation(location);
    setStage('fundis');
  };

  // Stage 2: Customer selects a fundi
  const handleFundiSelect = async (fundi) => {
    setSelectedFundi(fundi);
    
    // Create job with selected fundi
    const response = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Service Request',
        description: 'Clicking checkbox...',
        location: customerLocation.address,
        latitude: customerLocation.latitude,
        longitude: customerLocation.longitude,
        fundi_id: fundi.userId,
        estimated_price: 5000,
      }),
    });
    
    const data = await response.json();
    if (data.success) {
      setJobId(data.job.id);
      setJobAmount(data.job.estimated_price);
      setStage('payment');
    }
  };

  // Stage 3: Payment
  const handlePaymentSuccess = () => {
    setStage('done');
  };

  return (
    <div className="space-y-6">
      {/* Stage 1: Location */}
      {stage === 'location' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Where do you need service?</h2>
          <LocationPicker
            onSelectLocation={handleLocationSelect}
            placeholder="Enter your location..."
          />
        </div>
      )}

      {/* Stage 2: Find Fundis */}
      {stage === 'fundis' && customerLocation && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Select a Fundi</h2>
          <NearbyFundisMap
            latitude={customerLocation.latitude}
            longitude={customerLocation.longitude}
            radius={15}
            onSelectFundi={handleFundiSelect}
          />
        </div>
      )}

      {/* Stage 3: Payment */}
      {stage === 'payment' && jobId && selectedFundi && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Complete Payment</h2>
          <MpesaPaymentModal
            jobId={jobId}
            amount={jobAmount}
            fundiName={selectedFundi.name}
            onPaymentSuccess={handlePaymentSuccess}
          />
        </div>
      )}

      {/* Stage 4: Done */}
      {stage === 'done' && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold">Job Created!</h2>
          <p className="text-gray-600 mt-2">
            {selectedFundi?.name} will be on their way shortly
          </p>
          {jobId && <PaymentStatus jobId={jobId} />}
        </div>
      )}
    </div>
  );
}
```

### Fundi Registration with Location Setup

```tsx
import React from 'react';
import { LocationEditor } from '@/components/maps';

export function FundiRegistrationStep() {
  const handleSaveLocation = async (location) => {
    const response = await fetch('/api/fundi/location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(location),
    });

    if (response.ok) {
      alert('Location saved successfully!');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Set Your Working Location</h1>
      <LocationEditor onSaveLocation={handleSaveLocation} />
    </div>
  );
}
```

## Environment Variables

### Google Maps API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable these APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
   - Distance Matrix API
4. Create an API key in "Credentials"
5. Add it to `.env`:

```env
GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
VITE_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
```

### M-Pesa (Daraja) Setup

1. Register for [Safaricom Daraja](https://developer.safaricom.co.ke/docs)
2. Create an app to get Consumer Key and Consumer Secret
3. Configure your Business Shortcode and Passkey
4. Set callback URL in your app dashboard
5. Add to `.env`:

```env
MPESA_CONSUMER_KEY=YOUR_CONSUMER_KEY
MPESA_CONSUMER_SECRET=YOUR_CONSUMER_SECRET
MPESA_SHORTCODE=YOUR_SHORTCODE
MPESA_PASSKEY=YOUR_PASSKEY
MPESA_CALLBACK_URL=https://yourapp.com/api/payments/mpesa/callback
MPESA_ENV=sandbox  # sandbox or live
```

## Troubleshooting

### Maps not showing
- Verify `GOOGLE_MAPS_API_KEY` is set in `.env`
- Check browser console for API errors
- Ensure API is enabled in Google Cloud Console

### M-Pesa not responding
- Check `MPESA_CONSUMER_KEY` and `MPESA_CONSUMER_SECRET`
- Verify callback URL is publicly accessible
- Ensure phone number is in correct format (254...)
- Check M-Pesa account balance on test phone

### Nearby fundis not showing
- Verify fundis have coordinates (latitude/longitude)
- Check fundis are marked as `verified` and `subscription_active`
- Increase search radius if few fundis in area
- Check browser console for API errors

## Next Steps

1. Update your fundi registration flow to use `LocationEditor`
2. Update job creation flow to use `LocationPicker` and `NearbyFundisMap`
3. Add `MpesaPaymentModal` to job completion screens
4. Add `PaymentStatus` to job detail pages
5. Test with sandbox M-Pesa credentials first
6. Deploy and switch to live credentials when ready
