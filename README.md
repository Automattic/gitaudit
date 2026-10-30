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
- **Backend**: [Spacefast](https://spacefast.com/) Functions, MariaDB
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

The setup script also prints a sign-in link for a test user, which opens the signed-in pages without any GitHub credentials. Print it again at any time with `npm run seed`.

## Prerequisites

- Node.js 22+ and npm
- Docker, for the local database
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
6. Copy the **Client ID** (starts with `Iv1.`) and **Client Secret** to `.env`:

```bash
GITHUB_CLIENT_ID=Iv1.your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

## Running the Application

`sf dev` can't run workers, so `scripts/dev-functions.mjs` runs the app on port 3001 against a local MariaDB, the engine Spacefast uses. `scripts/local-db.mjs` stands in for `env.DB` and enforces the platform's limits, so a query that would fail there fails here first.

```bash
npm run db:start                # Start MariaDB 11.8 in Docker
npm run seed                    # Create the tables and add test data
npm run dev                     # Run the app
npm run test:functions          # Run the tests
npm run db:stop                 # Stop MariaDB, which also clears its data
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001

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

`/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io/) server, so assistants can answer questions about the projects with public dashboards. It's read-only and needs no sign-in, and the `/connect` page shows how to add it to an assistant.

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
│   └── src/
│       ├── components/  # Reusable UI components
│       ├── data/        # API clients and React Query hooks
│       ├── layouts/     # Page layouts
│       ├── pages/       # Application pages
│       └── utils/       # Utility functions
├── functions/           # The API, MCP server and step detection, as Spacefast Functions
├── scripts/             # Local development, seeding and the Spacefast build
├── package.json         # Root workspace configuration
└── README.md
```

## Development

### Test Data

Seed the database with sample data for local development:

```bash
# Add test data (preserves existing data)
npm run seed

# Reset and re-seed (clears all data first)
npm run seed:reset
```

The test data includes:
- `WordPress/gutenberg`: a public GitHub repository, with the metrics token `local-dev-gutenberg-token`
- `testdev/internal-tools`: a private custom repository, with the metrics token `local-dev-internal-tools-token`
- 9 metrics on each, with 600 data points over 60 days and clear regressions and improvements
- `testdev`, the user you sign in as, and `testcollaborator`, a user to add as a collaborator

Anything that calls GitHub, such as the GitHub tab of Add Repository, won't work as the test user because its token is fake.

## Spacefast

### Deploying

Pushing to `main` deploys production, so merging a pull request is a deploy. To publish to another space:

```bash
npm run build:spacefast
npx spacefast publish dist-spacefast --space <space>
```

A space needs these variables, set with `sf env set <name> --secret --value-from-stdin`:

| Variable | |
| --- | --- |
| `SESSION_SECRET` | Signs sessions. Changing it signs everyone out. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | The GitHub App. Add `https://<host>/auth/github/callback` to its callback URLs. |
| `MIGRATION_KEY` | Turns on `POST /api/admin/schema`, which creates the tables on a new space when sent with the key in an `x-migration-key` header. Unset it afterwards. |

### Platform limits

These aren't in Spacefast's docs, so they're worth knowing when changing queries:

- A statement can have 256 bound parameters at most, and a database operation can be 64 KB at most. Rows go in as one JSON parameter through `JSON_TABLE` for that reason.
- About 8 simultaneous requests get 429s, so a page shouldn't send a request per metric.
- Each query is a network call of about 55 ms, so reads that belong together are joined into one query.
- Route files must export named HTTP methods. A bundled `export default` isn't detected, and neither are exports followed by a comment, which is why the build strips license comments.
- All routes run as one worker, so a dependency in one route adds to the startup of all of them. The MCP SDK takes the worker from 157 KB to about 880 KB, which added about 30 ms to warm requests and up to 700 ms to the first one after a deploy.
- `functions/` can't serve paths in dot directories like `.well-known`. `_redirects` can, and the build uses it to answer the paths assistants check for a sign-in server, which would otherwise get the app's page and a 200.
- On a private space, a machine token's `/*` only covers one path level, and a 404 rule also needs the token to cover its destination.

## Acknowledgments

- Built with [@wordpress/components](https://github.com/WordPress/gutenberg/tree/trunk/packages/components)

## Support

If you encounter any issues or have questions:
- Check existing [GitHub Issues](https://github.com/Automattic/gitaudit/issues)
- Create a new issue with details about your problem
- Include relevant logs and configuration (remove sensitive data)
