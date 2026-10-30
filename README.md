# CodeVitals

CodeVitals tracks performance metrics for code repositories. Your CI reports a set of values for each commit, and CodeVitals charts them over time, flags regressions and improvements, and can share a repository's dashboard publicly.

## Features

- **Metrics over time**: Charts for each metric, with zoom and a choice of how much history to show
- **Regression detection**: Flags changes above 10%, with an optional per-metric noise floor
- **Baseline normalization**: Compares runs fairly across machines by reporting a base commit alongside each result
- **Public dashboards**: Share a repository's metrics without requiring sign-in
- **GitHub and custom repositories**: Track a GitHub repository, or any other repository by URL

## Tech Stack

- **Frontend**: React, TypeScript, Vite, @wordpress/components, Chart.js
- **Backend**: Node.js, Express, SQLite (better-sqlite3)
- **Authentication**: GitHub App (OAuth flow)

## Quick Start (with Test Data)

Get up and running in under 2 minutes with seeded test data:

```bash
git clone https://github.com/Automattic/gitaudit.git
cd gitaudit
./scripts/setup.sh
npm run dev
```

Open http://localhost:3000 to see the public dashboard for `WordPress/gutenberg`.

The setup script also prints a sign-in link for a test user, which opens the signed-in pages without any GitHub credentials. Print it again at any time with `npm run seed --workspace=server`.

## Prerequisites

- Node.js 18+ and npm
- A GitHub App, if you want to sign in with GitHub rather than as the test user

## Configure a GitHub App (Optional)

1. Go to [GitHub Settings → Developer settings → GitHub Apps](https://github.com/settings/apps) → New GitHub App
2. Fill in the details:
   - **GitHub App name**: CodeVitals (or your preferred name)
   - **Homepage URL**: `http://localhost:3000`
   - **Callback URL**: `http://localhost:3001/auth/github/callback` (add one per environment)
   - **Expire user authorization tokens**: **UNCHECK** this for non-expiring tokens
   - **Where can this GitHub App be installed?**: Any account
3. Set permissions:
   - Repository → Contents: Read
   - Repository → Metadata: Read (required)
   - Organization → Members: Read
   - Account → Email addresses: Read
4. Click "Create GitHub App"
5. Generate a client secret
6. Copy the **Client ID** (starts with `Iv1.`) and **Client Secret** to `server/.env`:

```bash
GITHUB_CLIENT_ID=Iv1.your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

## Running the Application

Start both client and server in development mode:

```bash
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## Usage

1. **Add a repository**: Pick one from GitHub, or create a custom one with a URL
2. **Define metrics**: In Settings → Metrics, add a key, name and unit for each value you want to track
3. **Copy the token**: Generate a metrics token in the same tab
4. **Report from CI**: Post your results for each commit (see below)
5. **Share it**: Optionally make the dashboard public from Settings → Metrics

### Reporting Metrics

CI reports results with a single request:

```bash
curl -X POST "https://codevitals.run/api/log?token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": "trunk",
    "hash": "abc123",
    "timestamp": "2026-01-01T00:00:00Z",
    "metrics": { "lcp": 2500 },
    "baseHash": "def456",
    "baseMetrics": { "lcp": 2400 }
  }'
```

Only keys that match a metric defined for the repository are stored. Report sizes in bytes: a metric with a unit of KB, MB, GB or TB is converted for display. `baseHash` and `baseMetrics` are optional: when the base commit already has a stored value, the new value is normalized against it, so results from different machines stay comparable.

This endpoint is used by CI in several projects outside this repository, so its URL and request format need to stay stable.

## Project Structure

```
codevitals/
├── client/              # React frontend (TypeScript + Vite)
│   ├── server.js        # Production server: serves the build and proxies /api/log
│   └── src/
│       ├── components/  # Reusable UI components
│       ├── data/        # API clients and React Query hooks
│       ├── layouts/     # Page layouts
│       ├── pages/       # Application pages
│       └── utils/       # Utility functions
├── server/              # Node.js backend (Express + SQLite)
│   └── src/
│       ├── db/          # Database setup and queries
│       ├── middleware/  # Express middleware
│       ├── routes/      # API routes
│       ├── services/    # GitHub API
│       └── utils/       # Utility functions
├── package.json         # Root workspace configuration
└── README.md
```

## Development

### Database

The backend uses SQLite with better-sqlite3 for data storage. The database file is created automatically on first run at the path specified in `DATABASE_PATH`.

### Test Data

Seed the database with sample data for local development:

```bash
# Add test data (preserves existing data)
npm run seed --workspace=server

# Reset and re-seed (clears all data first)
npm run seed:reset --workspace=server

# Preview without modifying database
npm run seed:reset --workspace=server -- --dry-run
```

The test data includes:
- `WordPress/gutenberg`: a public GitHub repository, with the metrics token `local-dev-gutenberg-token`
- `testdev/internal-tools`: a private custom repository, with the metrics token `local-dev-internal-tools-token`
- 9 metrics on each, with 600 data points over 60 days and clear regressions and improvements
- `testdev`, the user you sign in as, and `testcollaborator`, a user to add as a collaborator

Anything that calls GitHub, such as the GitHub tab of Add Repository, won't work as the test user because its token is fake.

## Acknowledgments

- Built with [@wordpress/components](https://github.com/WordPress/gutenberg/tree/trunk/packages/components)

## Support

If you encounter any issues or have questions:
- Check existing [GitHub Issues](https://github.com/Automattic/gitaudit/issues)
- Create a new issue with details about your problem
- Include relevant logs and configuration (remove sensitive data)
