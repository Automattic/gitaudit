#!/bin/bash
# GitAudit Local Development Setup Script
# Usage: ./scripts/setup.sh

set -e

echo "=============================================="
echo "GitAudit Local Development Setup"
echo "=============================================="

# Generate session secret
SESSION_SECRET=$(openssl rand -hex 32)

# Server .env
if [ ! -f server/.env ]; then
    echo ""
    echo "[1/3] Creating server/.env..."
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
DATABASE_PATH=./gitaudit.db
EOF
    echo "  Created server/.env"
    echo "  NOTE: Add your GitHub OAuth credentials to enable GitHub sync"
else
    echo "[1/3] server/.env already exists, skipping"
fi

# Client .env
if [ ! -f client/.env ]; then
    echo ""
    echo "[2/3] Creating client/.env..."
    cat > client/.env << EOF
VITE_API_URL=http://localhost:3001
EOF
    echo "  Created client/.env"
else
    echo "[2/3] client/.env already exists, skipping"
fi

# Install dependencies
echo ""
echo "[3/3] Installing dependencies..."
npm install

echo ""
echo "=============================================="
echo "Setup Complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo ""
echo "  1. (Optional) Add GitHub OAuth credentials to server/.env"
echo "     Skip this if you just want to test with seeded data"
echo ""
echo "  2. Seed the database with test data:"
echo "     npm run seed:reset --workspace=server"
echo ""
echo "  3. Start the development servers:"
echo "     npm run dev"
echo ""
echo "  4. Open http://localhost:3000"
echo ""
