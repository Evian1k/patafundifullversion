import './env.js';
import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import fundiRoutes from './routes/fundi.js';
import fundiRegistrationRoutes from './routes/fundi-registration.js';
import jobRoutes from './routes/jobs.js';
import uploadRoutes from './routes/upload.js';
import paymentRoutes from './routes/payments.js';
import subscriptionRoutes from './routes/subscriptions.js';
import userRoutes from './routes/users.js';
import policyRoutes from './routes/policies.js';
import rulesRoutes from './routes/rules.js';
import penaltiesRoutes from './routes/penalties.js';
import blogRoutes from './routes/blog.js';
import helpRoutes from './routes/help.js';
import supportRoutes from './routes/support.js';
import serviceRoutes from './routes/services.js';
import careersRoutes from './routes/careers.js';
import mapsRoutes from './routes/maps.js';
import adminContentRoutes from './routes/adminContent.js';

// Middleware
import { errorHandler } from './middlewares/errorHandler.js';
import { authMiddleware } from './middlewares/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// create HTTP server for socket.io
const server = http.createServer(app);

const defaultCorsOrigins = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://192.168.0.109:8081',
];

function getAllowedCorsOriginPatterns() {
  const patterns = new Set(defaultCorsOrigins);

  const fromEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const pattern of fromEnv) patterns.add(pattern);

  const frontendUrl = (process.env.FRONTEND_URL || '').trim();
  if (frontendUrl) patterns.add(frontendUrl);

  return [...patterns];
}

function isAllowedOrigin(origin, patterns) {
  if (!origin) return true; // non-browser / same-origin requests

  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  const originHostname = parsedOrigin.hostname;
  const originProtocol = parsedOrigin.protocol;

  for (const pattern of patterns) {
    if (!pattern) continue;
    if (!pattern.includes('*')) {
      if (pattern.includes('://')) {
        if (origin === pattern) return true;
        continue;
      }
      if (originHostname === pattern) return true;
      continue;
    }

    const m = pattern.match(/^(https?):\/\/(.+)$/);
    const requiredProtocol = m ? `${m[1]}:` : null;
    let hostPattern = m ? m[2] : pattern;
    hostPattern = hostPattern.split('/')[0];
    hostPattern = hostPattern.split(':')[0];

    if (requiredProtocol && originProtocol !== requiredProtocol) continue;

    if (hostPattern.startsWith('*.')) {
      const suffix = hostPattern.slice(1); // keep the leading dot
      if (originHostname.endsWith(suffix)) return true;
      continue;
    }

    if (originHostname === hostPattern) return true;
  }

  return false;
}

const corsOriginPatterns = getAllowedCorsOriginPatterns();
const corsOriginFn = (origin, callback) => {
  callback(null, isAllowedOrigin(origin, corsOriginPatterns));
};

// Middleware
app.use(cors({
  origin: corsOriginFn,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/fundi/registration', fundiRegistrationRoutes);
app.use('/api/fundi', fundiRoutes);
app.use('/api/jobs', authMiddleware, jobRoutes);
// payments router protects endpoints internally; callback must be unauthenticated
app.use('/api/payments', paymentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', authMiddleware, uploadRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/penalties', penaltiesRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/careers', careersRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/admin/content', adminContentRoutes);

// Error handling
app.use(errorHandler);

// Attach socket.io
const io = new IOServer(server, {
  cors: {
    origin: corsOriginFn,
    methods: ['GET', 'POST']
  }
});

// initialize realtime handlers lazily to avoid circular imports
import initRealtime from './services/realtime.js';
initRealtime(io);

// Dev convenience: ensure the configured admin account exists after DB clean/reset.
import { bootstrapAdmin } from './services/adminBootstrap.js';
bootstrapAdmin().catch((err) => console.error('Admin bootstrap failed:', err.message));

// Seed legal/support content so footer links are never empty (idempotent).
import { seedDefaultContent } from './services/defaultContentSeed.js';
seedDefaultContent().catch((err) => console.error('Default content seed failed:', err.message));

server.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
