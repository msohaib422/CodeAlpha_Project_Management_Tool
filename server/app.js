const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// Load env from this file's own directory so config loading does not depend on
// the process working directory (important for serverless/Vercel cold starts).
dotenv.config({ path: path.join(__dirname, '.env') });
// Also fall back to the default cwd-based location for local dev convenience.
dotenv.config();

const app = express();

try {
  const { verifyEmailConfig } = require('./utils/emailService');
  verifyEmailConfig();
} catch (e) {
  console.warn('[email] config check failed:', e.message);
}

// Build the explicit allow-list from CLIENT_URL (comma-separated).
// In production the frontend and backend share the same Vercel origin, so
// same-origin requests are also allowed automatically (see isAllowedOrigin).
const allowedOrigins = (process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173'))
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function isAllowedOrigin(origin, req) {
  if (!origin) return true;
  // Explicit allow-list.
  if (allowedOrigins.includes(origin)) return true;
  // Preserve existing behavior: an explicit CLIENT_URL='*' opt-in allows any
  // origin (still reflected per-request, so credentials keep working).
  if (allowedOrigins.includes('*')) return true;
  // Same-origin: the request Origin host matches the request Host header.
  // This covers the Vercel production domain and every preview deployment
  // without needing to enumerate them, while still being explicit per request.
  try {
    const originHost = new URL(origin).host;
    const requestHost = (req.headers.host || '').trim();
    if (originHost && requestHost && originHost === requestHost) return true;
  } catch (e) {
    // ignore malformed origin
  }
  return false;
}

// CORS handling (explicit origins + credentials + preflight).
// Placed BEFORE the DB connection middleware so preflight never touches Mongo.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = !origin || isAllowedOrigin(origin, req);

  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    if (!allowed) return res.sendStatus(403);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Content-Type,Authorization'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.sendStatus(204);
  }

  next();
});

// Ensure MongoDB connection is established (and reused) for each request.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('Database connection error:', error.message);
    res.status(500).json({ message: 'Database connection failed' });
  }
});

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/comments', require('./routes/commentRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/invitations', require('./routes/invitationRoutes'));

app.get('/', (req, res) => {
  res.send('Collaborative Project Management API is running...');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;