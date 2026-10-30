#!/bin/bash
# CodeVitals Local Development Setup Script
# Usage: ./scripts/setup.sh

set -e

echo "=============================================="
echo "CodeVitals Local Development Setup"
echo "=============================================="

# Generate session secret
SESSION_SECRET=$(openssl rand -hex 32)

# .env
if [ ! -f .env ]; then
    echo ""
    echo "[1/4] Creating .env..."
    cat > .env << EOF
# GitHub OAuth (required for GitHub sign-in, optional for test data)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Session secret (auto-generated)
SESSION_SECRET=$SESSION_SECRET

# Where sign-in returns to
CLIENT_URL=http://localhost:3000
EOF
    echo "  Created .env"
else
    echo "[1/4] .env already exists, skipping"
fi

# Install dependencies
echo ""
echo "[2/4] Installing dependencies..."
npm install

# Start the database
echo ""
echo "[3/4] Starting MariaDB..."
if [ -z "$(docker ps -q --filter name=codevitals-db)" ]; then
    npm run db:start
fi
until docker exec codevitals-db healthcheck.sh --connect --innodb_initialized > /dev/null 2>&1; do
    sleep 1
done

# Seed database with test data
echo ""
echo "[4/4] Seeding database with test data..."
npm run seed:reset

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
echo "(Optional) To sign in with GitHub, add OAuth credentials to .env"
echo ""
