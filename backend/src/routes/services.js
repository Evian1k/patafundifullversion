import express from 'express';
import { query } from '../db.js';
import { AppError } from '../utils/errors.js';

const router = express.Router();

const SERVICE_DEFS = [
  { slug: 'plumbing', name: 'Plumbing', skill: 'Plumbing', description: 'Pipes, leaks, installations' },
  { slug: 'electrical', name: 'Electrical', skill: 'Electrical', description: 'Wiring, repairs, installations' },
  { slug: 'hvac', name: 'AC & HVAC', skill: 'AC & HVAC', description: 'Cooling, heating, maintenance' },
  { slug: 'cleaning', name: 'Cleaning', skill: 'Cleaning', description: 'Home, office, deep cleaning' },
  { slug: 'carpentry', name: 'Carpentry', skill: 'Carpentry', description: 'Furniture, repairs, custom work' },
];

function getServiceBySlug(slug) {
  return SERVICE_DEFS.find((s) => s.slug === slug) || null;
}

router.get('/', async (req, res, next) => {
  try {
    const counts = await query(
      `SELECT skill, COUNT(*)::int AS count
       FROM (
         SELECT unnest(fp.skills) AS skill
         FROM fundi_profiles fp
         JOIN users u ON u.id = fp.user_id
         WHERE fp.verification_status = 'approved'
           AND u.status = 'active'
           AND u.role = 'fundi'
       ) t
       GROUP BY skill`,
      []
    );
    const countBySkill = new Map(counts.rows.map((r) => [r.skill, r.count]));

    res.json({
      success: true,
      services: SERVICE_DEFS.map((s) => ({
        slug: s.slug,
        name: s.name,
        description: s.description,
        availableFundis: countBySkill.get(s.skill) || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim();
    const def = getServiceBySlug(slug);
    if (!def) throw new AppError('Service not found', 404);

    const fundis = await query(
      `WITH ratings AS (
         SELECT reviewee_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*)::int AS review_count
         FROM reviews
         GROUP BY reviewee_id
       )
       SELECT
         fp.user_id,
         fp.first_name,
         fp.last_name,
         fp.location_area,
         fp.location_city,
         fp.location_address,
         fp.skills,
         fp.experience_years,
         fp.latitude,
         fp.longitude,
         COALESCE(r.avg_rating, 0) AS rating,
         COALESCE(r.review_count, 0) AS review_count
       FROM fundi_profiles fp
       JOIN users u ON u.id = fp.user_id
       LEFT JOIN ratings r ON r.reviewee_id = fp.user_id
       WHERE fp.verification_status = 'approved'
         AND u.status = 'active'
         AND u.role = 'fundi'
         AND fp.skills @> ARRAY[$1]::text[]
       ORDER BY rating DESC NULLS LAST, review_count DESC, fp.created_at DESC
       LIMIT 50`,
      [def.skill]
    );

    res.json({
      success: true,
      service: { slug: def.slug, name: def.name, description: def.description },
      fundis: fundis.rows.map((f) => ({
        id: f.user_id,
        name: [f.first_name, f.last_name].filter(Boolean).join(' ').trim() || 'Fundi',
        location: f.location_city || f.location_area || null,
        locationAddress: f.location_address || null,
        skills: f.skills || [],
        experienceYears: f.experience_years || 0,
        rating: Number(f.rating) || 0,
        reviewCount: Number(f.review_count) || 0,
        latitude: f.latitude,
        longitude: f.longitude,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;

