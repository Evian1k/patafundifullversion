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

// Middleware
import { errorHandler } from './middlewares/errorHandler.js';
import { authMiddleware } from './middlewares/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// create HTTP server for socket.io
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082', 'http://192.168.0.109:8081'],
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

// Error handling
app.use(errorHandler);

// Attach socket.io
const io = new IOServer(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082'],
    methods: ['GET', 'POST']
  }
});

// initialize realtime handlers lazily to avoid circular imports
import initRealtime from './services/realtime.js';
initRealtime(io);

// Dev convenience: ensure the configured admin account exists after DB clean/reset.
import { bootstrapAdmin } from './services/adminBootstrap.js';
bootstrapAdmin().catch((err) => console.error('Admin bootstrap failed:', err.message));

server.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
