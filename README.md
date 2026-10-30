# CodeVitals

CodeVitals tracks performance metrics for code repositories. Your CI reports a set of values for each commit, and CodeVitals charts them over time, flags regressions and improvements, and can share a repository's dashboard publicly.

## Features

- **Metrics over time**: Charts for each metric, with zoom and a choice of how much history to show
- **Regression detection**: Flags changes above 10%, with an optional per-metric noise floor
- **Baseline normalization**: Compares runs fairly across machines by reporting a base commit alongside each result
- **Public dashboards**: Share a repository's metrics without requiring sign-in
- **MCP server**: Ask an AI assistant about any project with a public dashboard
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

### Asking an AI Assistant

`/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io/) server, so assistants can answer questions about the projects with public dashboards. It's read-only and needs no sign-in, and the `/connect` page shows how to add it to an assistant. It runs on Spacefast only, so it isn't on the Railway deployment.

| Tool | |
| --- | --- |
| `list_projects` | The public projects, and when each last reported |
| `list_metrics` | What a project measures, with recent levels and how they moved |
| `get_metric_history` | A metric over a period, one value per commit |
| `find_changes` | Lasting changes, and the commit each started at |
| `compare_commits` | Every metric at a commit, against the commits before it or another commit |

`find_changes` doesn't use the regression flags on the charts, which compare each point with the one before it, so most of them are noise that the next commit undoes. `functions/_lib/steps.js` looks for lasting changes instead, comparing the 15 commits either side of each commit. It was tuned by shuffling each metric's public history, which removes real changes and keeps the noise, so whatever it finds there is a false positive: about one across all 133 metrics, against 25 changes in the real data.

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
├── functions/           # The API, MCP server and step detection, as Spacefast Functions
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

## Spacefast

The app is moving from Railway to [Spacefast](https://spacefast.com/). `functions/` holds the same API rewritten as Spacefast Functions, next to the Express server in `server/`, which keeps serving production until the move is done.

### Running the Functions app locally

`sf dev` can't run workers, so `scripts/dev-functions.mjs` runs the app on port 3001 against a local MariaDB, the engine Spacefast uses. `scripts/local-db.mjs` stands in for `env.DB` and enforces the platform's limits, so a query that would fail there fails here first.

```bash
npm run db:start                # Start MariaDB 11.8 in Docker
npm run test:functions          # Run the tests
npm run dev:functions           # Run the app on http://localhost:3000
```

To load test data, seed SQLite as usual, then import it while `dev:functions` is running:

```bash
npm run seed:reset --workspace=server
MIGRATION_KEY=local-dev-migration-key node scripts/import-to-spacefast.mjs server/codevitals.db http://localhost:3001
```

### Deploying

```bash
npm run build:spacefast
npx spacefast publish dist-spacefast --space <space>
```

A space needs these variables, set with `sf env set <name> --secret --value-from-stdin`:

| Variable | |
| --- | --- |
| `SESSION_SECRET` | Signs sessions. Keeping the value from Railway keeps people signed in. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | The GitHub App. Add `https://<host>/auth/github/callback` to its callback URLs. |
| `MIGRATION_KEY` | Turns on the `/api/admin` routes for importing data. Unset it afterwards. |

### Importing data

`scripts/import-to-spacefast.mjs` copies a SQLite database into a space through those admin routes. Rows keep their ids, so it's safe to run again, and it compares row counts when it finishes. Use `--new-only` for the final sync before switching DNS, and once more afterwards for anything that reached Railway while DNS moved. Rows made on a space start at a reserved id, so they can't collide with Railway's. While a space is private, set `SPACE_TOKEN` to a machine token from `sf share token create`.

### Platform limits

These aren't in Spacefast's docs, so they're worth knowing when changing queries:

- A statement can have 256 bound parameters at most, and a database operation can be 64 KB at most. Rows go in as one JSON parameter through `JSON_TABLE` for that reason.
- About 8 simultaneous requests get 429s, so a page shouldn't send a request per metric.
- Each query is a network call of about 55 ms, so reads that belong together are joined into one query.
- Route files must export named HTTP methods. A bundled `export default` isn't detected, and neither are exports followed by a comment, which is why the build strips license comments.
- All routes run as one worker, so a dependency in one route adds to the startup of all of them. The MCP SDK takes the worker from 157 KB to 868 KB, which added about 30 ms to warm requests and up to 700 ms to the first one after a deploy.
- `functions/` can't serve paths in dot directories like `.well-known`. `_redirects` can, and the build uses it to answer the paths assistants check for a sign-in server, which would otherwise get the app's page and a 200.
- On a private space, a machine token's `/*` only covers one path level, and a 404 rule also needs the token to cover its destination.

## Acknowledgments

- Built with [@wordpress/components](https://github.com/WordPress/gutenberg/tree/trunk/packages/components)

## Support

If you encounter any issues or have questions:
- Check existing [GitHub Issues](https://github.com/Automattic/gitaudit/issues)
- Create a new issue with details about your problem
- Include relevant logs and configuration (remove sensitive data)
