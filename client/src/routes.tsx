import { Navigate, redirect, useParams, type LoaderFunctionArgs } from 'react-router-dom';
import { queryClient } from './data/queries/query-client';
import { repoPermissionQueryOptions } from './data/queries/repos';
import Homepage from './pages/homepage';
import Login from './pages/login';
import AuthCallback from './pages/auth-callback';
import RepoSelector from './pages/repo-selector';
import Settings from './pages/settings';
import MetricsDashboard from './pages/metrics-dashboard';
import PublicMetricsDashboard from './pages/public-metrics-dashboard';
import Connect from './pages/connect';
import RepositoryLayout from './layouts/repository-layout';
import AppLayout from './layouts/app-layout';
import { isMcpEnabled } from './lib/mcp';

// Helper to check authentication and redirect if needed
function checkAuth(request: Request) {
  const token = localStorage.getItem('token');
  if (!token) {
    const url = new URL(request.url);
    return redirect(`/login?from=${encodeURIComponent(url.pathname)}`);
  }
  return null;
}

// Protected loader - redirects to login if not authenticated
export async function protectedLoader({ request }: { request: Request }) {
  return checkAuth(request);
}

// Repository layout loader - checks auth AND prefetches permission data
export async function repositoryLayoutLoader({ params, request }: LoaderFunctionArgs) {
  // Check authentication
  const authRedirect = checkAuth(request);
  if (authRedirect) return authRedirect;

  // Prefetch the permission query to avoid layout shift
  const { owner, repo } = params;
  if (!owner || !repo) {
    throw new Response('Repository not found', { status: 404 });
  }
  await queryClient.ensureQueryData(repoPermissionQueryOptions(owner, repo));

  return null;
}

function RedirectToMetrics() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  return <Navigate to={`/repos/${owner}/${repo}/metrics`} replace />;
}

export const routes = [
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallback />,
  },
  {
    path: '/repos',
    loader: protectedLoader,
    element: (
      <AppLayout>
        <RepoSelector />
      </AppLayout>
    ),
  },
  {
    path: '/repos/:owner/:repo',
    loader: repositoryLayoutLoader,
    element: <RepositoryLayout />,
    children: [
      {
        index: true,
        element: <RedirectToMetrics />,
      },
      {
        path: 'metrics',
        element: <MetricsDashboard />,
      },
      {
        path: 'settings',
        children: [
          {
            index: true,
            element: <Navigate to="metrics" replace />,
          },
          {
            path: ':section',
            element: <Settings />,
          },
        ],
      },
      {
        // Links to the removed issue and PR reports
        path: '*',
        element: <RedirectToMetrics />,
      },
    ],
  },
  {
    path: '/public/:owner/:repo/metrics',
    element: <PublicMetricsDashboard />,
  },
  ...(isMcpEnabled ? [{ path: '/connect', element: <Connect /> }] : []),
  {
    path: '/',
    element: <Homepage />,
  },
];
