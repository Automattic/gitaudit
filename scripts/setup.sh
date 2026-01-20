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
# GitHub OAuth (required for GitHub sync, optional for test data)
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
echo "Test data has been loaded for WordPress/gutenberg with:"
echo "  - 20 issues (bugs, stale issues, feature requests)"
echo "  - 12 pull requests (various states)"
echo "  - 7 performance metrics with 30 days of data"
echo ""
echo "To start the app:"
echo "  npm run dev"
echo ""
echo "Then open http://localhost:3000 and add WordPress/gutenberg"
echo "to your repositories to see the pre-loaded test data."
echo ""
echo "(Optional) To sync real GitHub data, add OAuth credentials to server/.env"
echo ""
