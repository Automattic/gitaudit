#!/bin/bash
# CodeVitals Local Development Setup Script
# Usage: ./scripts/setup.sh

set -e

echo "=============================================="
echo "CodeVitals Local Development Setup"
echo "=============================================="

# Generate session secret
SESSION_SECRET=$(openssl rand -hex 32)

# Server .env
if [ ! -f server/.env ]; then
    echo ""
    echo "[1/4] Creating server/.env..."
    cat > server/.env << EOF
# GitHub OAuth (required for GitHub sign-in, optional for test data)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Session secret (auto-generated)
SESSION_SECRET=$SESSION_SECRET

# Server config
PORT=3001
CLIENT_URL=http://localhost:3000

# Database path (local development)
DATABASE_PATH=./codevitals.db
EOF
    echo "  Created server/.env"
else
    echo "[1/4] server/.env already exists, skipping"
fi

# Client .env
if [ ! -f client/.env ]; then
    echo ""
    echo "[2/4] Creating client/.env..."
    cat > client/.env << EOF
VITE_API_URL=http://localhost:3001
EOF
    echo "  Created client/.env"
else
    echo "[2/4] client/.env already exists, skipping"
fi

# Install dependencies
echo ""
echo "[3/4] Installing dependencies..."
npm install

# Seed database with test data
echo ""
echo "[4/4] Seeding database with test data..."
npm run seed:reset --workspace=server

echo ""
echo "=============================================="
echo "Setup Complete!"
echo "=============================================="
echo ""
echo "Test data has been loaded for two repositories, each with 9 metrics"
echo "and 60 days of history: WordPress/gutenberg and testdev/internal-tools."
echo ""
echo "To start the app:"
echo "  npm run dev"
echo ""
echo "Then open http://localhost:3000, or use the sign-in link printed above"
echo "to get to the signed-in pages as the test user."
echo ""
echo "(Optional) To sign in with GitHub, add OAuth credentials to server/.env"
echo ""
