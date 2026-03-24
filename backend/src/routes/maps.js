import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';
import { authMiddleware } from '../middlewares/auth.js';
import {
  calculateDistance,
  geocodeAddress,
  reverseGeocodeCoordinates,
  getPlacePredictions,
  getPlaceDetails,
} from '../services/geolocation.js';

const router = express.Router();

/**
 * Geocode an address to coordinates
 */
router.post('/geocode', async (req, res, next) => {
  try {
    const { address } = req.body;
    if (!address) {
      throw new AppError('Address is required', 400);
    }

    const result = await geocodeAddress(address);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Reverse geocode coordinates to address
 */
router.post('/reverse-geocode', async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      throw new AppError('Latitude and longitude are required', 400);
    }

    const result = await reverseGeocodeCoordinates(latitude, longitude);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get place autocomplete predictions
 */
router.get('/place-predictions', async (req, res, next) => {
  try {
    const { input, lat, lng, radius } = req.query;
    if (!input) {
      throw new AppError('Input is required', 400);
    }

    const bias = lat && lng ? { latitude: parseFloat(lat), longitude: parseFloat(lng), radius: radius ? parseInt(radius) : 50000 } : null;

    const predictions = await getPlacePredictions(input, bias);
    res.json({
      success: true,
      predictions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get place details from place ID
 */
router.get('/place-details/:placeId', async (req, res, next) => {
  try {
    const { placeId } = req.params;
    const result = await getPlaceDetails(placeId);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Find nearby fundis
 * Query params:
 *   - latitude: customer latitude
 *   - longitude: customer longitude
 *   - radius: search radius in km (default 10)
 *   - category: optional service category to filter
 *   - limit: max number of results (default 10)
 */
router.get('/nearby-fundis', async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 10, category, limit = 10 } = req.query;

    if (!latitude || !longitude) {
      throw new AppError('Latitude and longitude are required', 400);
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const rad = parseFloat(radius);
    const lim = Math.min(parseInt(limit) || 10, 50);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new AppError('Invalid coordinates', 400);
    }

    let sql = `
      SELECT
        fp.user_id,
        u.full_name,
        u.phone,
        fp.skills,
        fp.location_city,
        fp.location_area,
        fp.location_address,
        fp.latitude,
        fp.longitude,
        fp.experience_years,
        fp.subscription_active,
        fp.verification_status,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(r.id) as review_count
      FROM fundi_profiles fp
      JOIN users u ON u.id = fp.user_id
      LEFT JOIN reviews r ON r.reviewee_id = u.id
      WHERE fp.latitude IS NOT NULL
        AND fp.longitude IS NOT NULL
        AND u.status = 'active'
        AND fp.verification_status = 'approved'
        AND fp.subscription_active = true
    `;

    const params = [lat, lng, rad];
    let paramIndex = 4;

    // Add category filter if provided
    if (category) {
      sql += ` AND fp.skills && $${paramIndex}`;
      params.push([category]);
      paramIndex++;
    }

    sql += `
      GROUP BY fp.user_id, u.full_name, u.phone, fp.skills, fp.location_city, fp.location_area, fp.location_address, fp.latitude, fp.longitude, fp.experience_years, fp.subscription_active, fp.verification_status
      ORDER BY (
        SQRT(
          POWER(69.1 * (fp.latitude - $1), 2) +
          POWER(69.1 * (fp.longitude - $2) * COS(RADIANS(fp.latitude)), 2)
        )
      ) ASC
      LIMIT ${lim}
    `;

    sql = sql.replace('$1', `$1`).replace('$2', `$2`).replace('$3', `$3`);

    const result = await query(sql, params.slice(0, 3));

    // Calculate actual distances using Haversine
    const fundis = result.rows.map((fundi) => {
      const distance = calculateDistance(lat, lng, parseFloat(fundi.latitude), parseFloat(fundi.longitude));
      return {
        userId: fundi.user_id,
        name: fundi.full_name,
        phone: fundi.phone,
        skills: fundi.skills,
        location: {
          city: fundi.location_city,
          area: fundi.location_area,
          address: fundi.location_address,
          latitude: parseFloat(fundi.latitude),
          longitude: parseFloat(fundi.longitude),
        },
        experience: fundi.experience_years,
        rating: {
          avg: parseFloat(fundi.avg_rating),
          count: parseInt(fundi.review_count),
        },
        distanceKm: parseFloat(distance.toFixed(2)),
        subscriptionActive: fundi.subscription_active,
        verified: fundi.verification_status === 'approved',
      };
    });

    res.json({
      success: true,
      center: { latitude: lat, longitude: lng },
      radius: rad,
      count: fundis.length,
      fundis,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Calculate distance between two points
 */
router.post('/distance', async (req, res, next) => {
  try {
    const { origin, destination } = req.body;

    if (!origin || !destination) {
      throw new AppError('Origin and destination are required', 400);
    }

    const distance = calculateDistance(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude
    );

    res.json({
      success: true,
      distance: parseFloat(distance.toFixed(2)),
      unit: 'km',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
