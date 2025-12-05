import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Only proxy the GitHub OAuth endpoints, not the callback
      '/auth/github': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/auth/verify': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true, // Listen on all addresses including LAN and public
    allowedHosts: true, // Allow all hosts (Railway, custom domains, etc.)
    port: process.env.PORT || 4173,
  },
});
