import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/database.js';
import { startJobRunner } from './services/job-queue.js';
import authRoutes from './routes/auth.js';
import reposRoutes from './routes/repos.js';
import issuesRoutes from './routes/issues.js';
import prRoutes from './routes/pull-requests.js';

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
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
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
