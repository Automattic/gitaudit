import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';

// Proxy /api/log to the backend server
app.use('/api/log', createProxyMiddleware({
  target: API_URL,
  changeOrigin: true,
  pathRewrite: (path) => `/api/log${path}`,
}));

// Serve static files from dist/
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Client server running on http://localhost:${PORT}`);
  console.log(`Proxying /api/log to ${API_URL}`);
});
