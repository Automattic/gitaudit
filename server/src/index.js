import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/database.js';
import { startJobRunner } from './services/job-queue.js';
import authRoutes from './routes/auth.js';
import reposRoutes from './routes/repos.js';
import issuesRoutes from './routes/issues.js';
import prRoutes from './routes/pull-requests.js';
import metricsRoutes from './routes/metrics.js';
import logRoutes from './routes/log.js';
import perfRoutes from './routes/perf.js';
import publicReposRoutes from './routes/public-repos.js';

// Load environment variables
dotenv.config();

// Initialize database
initializeDatabase();

// Start the job runner (after database is initialized)
startJobRunner();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - required for Railway and other hosting platforms
// This allows Express to correctly detect HTTPS from X-Forwarded-Proto header
app.set('trust proxy', 1);

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(url => url.trim());

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/repos', reposRoutes);
app.use('/api/repos/:owner/:repo/issues', issuesRoutes);
app.use('/api/repos/:owner/:repo/prs', prRoutes);
app.use('/api/repos/:owner/:repo/metrics', metricsRoutes);
app.use('/api/repos/:owner/:repo/perf', perfRoutes);
app.use('/api/log', logRoutes);
app.use('/api/public-repos', publicReposRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
