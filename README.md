# GitAudit

A powerful web application for auditing GitHub repository issues and pull requests. GitAudit helps maintainers prioritize work by identifying important bugs, stale issues, promising feature requests, and community health metrics using intelligent analysis and optional AI-powered sentiment analysis.

## Features

- **Important Bugs Detection**: Automatically identify and prioritize critical bugs based on labels, reactions, comments, and optional AI sentiment analysis
- **Stale Issues & PRs**: Track issues and pull requests that may need re-validation or closure
- **Feature Request Analysis**: Discover promising feature requests from the community with AI-powered sentiment scoring
- **Community Health**: Monitor community engagement and maintainer response times
- **GitHub OAuth**: Secure authentication with GitHub
- **Real-time Sync**: Automatic synchronization with GitHub repositories
- **Smart Caching**: SQLite-based caching for fast performance
- **AI-Powered Analysis**: Optional sentiment analysis using Anthropic Claude or OpenAI GPT models

## Tech Stack

- **Frontend**: React, TypeScript, Vite, @wordpress/components, @wordpress/dataviews
- **Backend**: Node.js, Express, SQLite (better-sqlite3)
- **Authentication**: GitHub OAuth
- **API**: GitHub GraphQL API
- **AI Integration**: Vercel AI SDK with Anthropic Claude and OpenAI support

## Prerequisites

- Node.js 18+ and npm
- GitHub account
- (Optional) Anthropic or OpenAI API key for sentiment analysis

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Automattic/gitaudit.git
cd gitaudit
```

### 2. Install Dependencies

```bash
npm install
```

This will install dependencies for both the client and server workspaces.

### 3. Create GitHub OAuth App

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers) → New OAuth App
2. Fill in the details:
   - **Application name**: GitAudit (or your preferred name)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3001/auth/github/callback`
3. Click "Register application"
4. Copy the **Client ID** and generate a **Client Secret**

### 4. Configure Environment Variables

#### Backend Configuration

Copy the example file and edit it:

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```bash
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
SESSION_SECRET=your_random_secret_here
PORT=3001
CLIENT_URL=http://localhost:3000
DATABASE_PATH=/data/gitaudit.db
```

Generate a secure session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Frontend Configuration

Copy the example file:

```bash
cp client/.env.example client/.env
```

The default configuration should work for local development:

```bash
VITE_API_URL=http://localhost:3001
```

### 5. Run the Application

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

GitAudit supports optional AI-powered sentiment analysis to better prioritize bugs and feature requests:

1. Navigate to Settings → General
2. Enable "AI Sentiment Analysis"
3. Choose your provider (Anthropic Claude or OpenAI GPT)
4. Enter your API key
5. (Optional) Specify a model name or use defaults
6. Test your API key with the "Test API Key" button

**Note**: AI API calls will incur costs from your chosen provider. Monitor your usage carefully.

## Project Structure

```
gitaudit/
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

### API Rate Limiting

GitAudit implements smart rate limiting to respect GitHub's API limits:
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
