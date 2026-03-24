/**
 * Geolocation service for maps and nearby searches
 * Uses OpenStreetMap Nominatim API (free tier)
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

function nominatimHeaders() {
  return {
    'User-Agent': 'PataFundi/1.0 (your-email@example.com)',
    Accept: 'application/json',
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get coordinates from address using OpenStreetMap Nominatim
 */
export async function geocodeAddress(address) {
  if (!address) {
    throw new Error('Address is required');
  }

  const url = `${NOMINATIM_BASE}/search?format=json&addressdetails=1&q=${encodeURIComponent(address)}&limit=1`;
  const res = await fetch(url, { headers: nominatimHeaders() });
  const data = await res.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No results found for address');
  }

  const top = data[0];
  return {
    address: top.display_name,
    latitude: parseFloat(top.lat),
    longitude: parseFloat(top.lon),
    placeId: top.place_id,
    components: top.address,
  };
}

/**
 * Get address from coordinates using OpenStreetMap Nominatim reverse geocoding
 */
export async function reverseGeocodeCoordinates(latitude, longitude) {
  if (latitude === undefined || longitude === undefined) {
    throw new Error('Latitude and longitude are required');
  }

  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&addressdetails=1`;
  const res = await fetch(url, { headers: nominatimHeaders() });
  const data = await res.json();

  if (!data || !data.address) {
    throw new Error('Reverse geocoding failed');
  }

  return {
    address: data.display_name,
    placeId: data.place_id,
    components: data.address,
  };
}

/**
 * Get place predictions using OpenStreetMap Nominatim search
 */
export async function getPlacePredictions(input, bias = null) {
  if (!input) {
    return [];
  }

  let url = `${NOMINATIM_BASE}/search?format=json&addressdetails=1&limit=7&q=${encodeURIComponent(input)}`;

  if (bias && bias.latitude && bias.longitude) {
    url += `&viewbox=${bias.longitude - 0.5},${bias.latitude + 0.5},${bias.longitude + 0.5},${bias.latitude - 0.5}&bounded=1`;
  }

  // Optional Kenya restriction
  if (process.env.OSM_COUNTRYCODE) {
    url += `&countrycodes=${encodeURIComponent(process.env.OSM_COUNTRYCODE)}`;
  }

  const res = await fetch(url, { headers: nominatimHeaders() });
  const data = await res.json();

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item) => ({
    place_id: item.place_id,
    main_text: item.display_name.split(',')[0],
    secondary_text: item.display_name.split(',').slice(1).join(',').trim(),
    description: item.display_name,
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
  }));
}

/**
 * Get place details using OpenStreetMap Nominatim lookup
 */
export async function getPlaceDetails(placeId) {
  if (!placeId) {
    throw new Error('placeId is required');
  }

  const url = `${NOMINATIM_BASE}/lookup?format=json&addressdetails=1&place_ids=${encodeURIComponent(placeId)}`;
  const res = await fetch(url, { headers: nominatimHeaders() });
  const data = await res.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Place details not found');
  }

  const result = data[0];
  return {
    address: result.display_name,
    latitude: parseFloat(result.lat),
    longitude: parseFloat(result.lon),
    components: result.address,
  };
}

/**
 * Dummy placeholder for Distance Matrix tied to OSM (same origin/dest as for now)
 */
export async function getDistanceMatrix(origins, destinations) {
  // OSM doesn't provide a free distance matrix in this API; use Haversine fallback
  const rows = origins.map((origin) => ({
    elements: destinations.map((destination) => ({
      distance: {
        text: `${calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude).toFixed(1)} km`,
        value: calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude) * 1000,
      },
      duration: {
        text: 'N/A',
        value: null,
      },
      status: 'OK',
    })),
  }));

  return {
    rows,
    originAddresses: origins.map((o) => `${o.latitude},${o.longitude}`),
    destinationAddresses: destinations.map((d) => `${d.latitude},${d.longitude}`),
  };
}
