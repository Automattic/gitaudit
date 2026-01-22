# CodeVitals

CodeVitals is a repository health dashboard that helps maintainers focus on what matters. It automatically scores and prioritizes bugs by severity and community impact, detects stale issues and abandoned PRs, surfaces high-demand feature requests, and monitors community health metrics. Optional AI-powered sentiment analysis adds another dimension to prioritization.

## Features

- **Important Bugs Detection**: Automatically identify and prioritize critical bugs based on labels, reactions, comments, and optional AI sentiment analysis
- **Stale Issues & PRs**: Track issues and pull requests that may need re-validation or closure
- **Feature Request Analysis**: Discover promising feature requests from the community with AI-powered sentiment scoring
- **Community Health**: Monitor community engagement and maintainer response times
- **GitHub App Authentication**: Secure authentication with GitHub using fine-grained permissions
- **Real-time Sync**: Automatic synchronization with GitHub repositories
- **Smart Caching**: SQLite-based caching for fast performance
- **AI-Powered Analysis**: Optional sentiment analysis using Anthropic Claude or OpenAI GPT models

## Tech Stack

- **Frontend**: React, TypeScript, Vite, @wordpress/components, @wordpress/dataviews
- **Backend**: Node.js, Express, SQLite (better-sqlite3)
- **Authentication**: GitHub App (OAuth flow with fine-grained permissions)
- **API**: GitHub GraphQL API
- **AI Integration**: Vercel AI SDK with Anthropic Claude and OpenAI support

## Quick Start (with Test Data)

Get up and running in under 2 minutes with pre-seeded test data:

```bash
# 1. Clone and setup (includes installing deps and seeding test data)
git clone https://github.com/Automattic/gitaudit.git
cd gitaudit
./scripts/setup.sh

# 2. Start the app
npm run dev
```

Open http://localhost:3000 and add `WordPress/gutenberg` to your repositories—it will already have test data pre-loaded (20 issues, 12 PRs, and performance metrics).

> **Note**: Test data mode doesn't require GitHub authentication. When you add WordPress/gutenberg, you'll see the seeded data immediately without fetching from GitHub.

---

## Prerequisites

- Node.js 18+ and npm
- GitHub account (for syncing real repositories)
- (Optional) Anthropic or OpenAI API key for sentiment analysis

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Automattic/gitaudit.git
cd gitaudit
```

### 2. Automated Setup (Recommended)

Run the setup script to create environment files, install dependencies, and seed test data:

```bash
./scripts/setup.sh
```

This will:
- Create `server/.env` with a generated session secret
- Create `client/.env` with default API URL
- Install all dependencies
- Seed the database with test data for WordPress/gutenberg

### 3. (Optional) Configure GitHub App

Skip this step if you only want to test with seeded data.

1. Go to [GitHub Settings → Developer settings → GitHub Apps](https://github.com/settings/apps) → New GitHub App
2. Fill in the details:
   - **GitHub App name**: CodeVitals (or your preferred name)
   - **Homepage URL**: `http://localhost:3000`
   - **Callback URL**: `http://localhost:3001/auth/github/callback` (add one per environment)
   - **Expire user authorization tokens**: **UNCHECK** this for non-expiring tokens
   - **Where can this GitHub App be installed?**: Any account
3. Set permissions:
   - Repository → Contents: Read
   - Repository → Issues: Read
   - Repository → Pull requests: Read
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

### 4. Run the Application

Start both client and server in development mode:

```bash
npm run dev
```

Or run them separately:

```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run client
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## Usage

1. **Login**: Click "Sign in with GitHub" to authenticate
2. **Add Repository**: Select a repository you have access to
3. **Initial Sync**: Wait for the initial data fetch (may take a few minutes for large repos)
4. **Configure Settings**:
   - Set up label keywords for bugs, features, and priorities
   - (Optional) Configure AI sentiment analysis with your API key
   - Define maintainer team for community health metrics
5. **Explore Insights**: Navigate through different views:
   - Important Bugs: Prioritized list of critical issues
   - Feature Requests: Highly-requested features from the community
   - Stale Issues/PRs: Items that may need attention
   - Community Health: Engagement metrics

## AI Sentiment Analysis (Optional)

CodeVitals supports optional AI-powered sentiment analysis to better prioritize bugs and feature requests:

1. Navigate to Settings → General
2. Enable "AI Sentiment Analysis"
3. Choose your provider (Anthropic Claude or OpenAI GPT)
4. Enter your API key
5. (Optional) Specify a model name or use defaults
6. Test your API key with the "Test API Key" button

**Note**: AI API calls will incur costs from your chosen provider. Monitor your usage carefully.

## Project Structure

```
codevitals/
├── client/              # React frontend (TypeScript + Vite)
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── data/        # API clients and React Query hooks
│   │   ├── layouts/     # Page layouts
│   │   ├── pages/       # Application pages
│   │   └── utils/       # Utility functions
│   └── package.json
├── server/              # Node.js backend (Express + SQLite)
│   ├── src/
│   │   ├── db/          # Database setup and queries
│   │   ├── middleware/  # Express middleware
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic and GitHub API
│   │   └── utils/       # Utility functions
│   └── package.json
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

The test data includes WordPress/gutenberg with:
- 20 issues (critical bugs, stale issues, feature requests)
- 12 PRs (abandoned, approved, draft, etc.)
- 7 performance metrics with 30 days of data

### API Rate Limiting

CodeVitals implements smart rate limiting to respect GitHub's API limits:
- Serial request processing (one request at a time)
- Configurable delays between requests
- Automatic retry logic with exponential backoff
- Cooldown periods after rate limit hits

### Background Jobs

Issue and PR data is synchronized in the background:
- Initial fetch on repository addition
- Incremental updates for existing repositories
- Automatic refresh on user request
- Sentiment analysis runs lazily when viewing specific pages

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Acknowledgments

- Built with [@wordpress/components](https://github.com/WordPress/gutenberg/tree/trunk/packages/components) and [@wordpress/dataviews](https://github.com/WordPress/gutenberg/tree/trunk/packages/dataviews)
- Uses [Vercel AI SDK](https://sdk.vercel.ai/) for AI integration
- Inspired by the need for better issue triage workflows

## Support

If you encounter any issues or have questions:
- Check existing [GitHub Issues](https://github.com/Automattic/gitaudit/issues)
- Create a new issue with details about your problem
- Include relevant logs and configuration (remove sensitive data)
