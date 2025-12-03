# GitAudit

A web application for auditing GitHub repository issues to identify:
- Important bugs that need immediate attention
- Stale issues that need re-validation
- Potential duplicate issues
- Issues that need triaging

## Tech Stack

- **Frontend**: React + @wordpress/components + @automattic/charts
- **Backend**: Node.js + Express + SQLite
- **Auth**: GitHub OAuth
- **API**: GitHub GraphQL API

## Setup

### Prerequisites

- Node.js 18+ and npm
- GitHub account

### 1. Install Dependencies

```bash
npm install
```

### 2. Create GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps → New OAuth App
2. Fill in the details:
   - **Application name**: GitAudit (or your preferred name)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3001/auth/github/callback`
3. Click "Register application"
4. Copy the **Client ID** and generate a **Client Secret**

### 3. Configure Environment Variables

Create a `.env` file in the `server/` directory:

```bash
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
SESSION_SECRET=your_random_secret_here
PORT=3001
CLIENT_URL=http://localhost:3000
```

Generate a random session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run the Application

Start both client and server:

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
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Project Structure

```
gitaudit/
├── client/          # React frontend
├── server/          # Node.js backend
├── package.json     # Root package.json with workspaces
└── README.md
```

## Development Roadmap

### Iteration 1 (Current)
- [x] Project setup with monorepo structure
- [ ] GitHub OAuth authentication
- [ ] Repository selection
- [ ] Issue data fetching and caching
- [ ] Important Bugs analyzer

### Future Iterations
- Stale Issues detection
- Duplicate detection
- Triage Queue
- Unified dashboard with all metrics

## License

MIT
