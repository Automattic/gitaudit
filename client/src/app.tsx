import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './data/queries/query-client';
import { AuthProvider, useAuth } from './context/auth-context';
import Login from './pages/login';
import AuthCallback from './pages/auth-callback';
import RepoSelector from './pages/repo-selector';
import ImportantBugs from './pages/important-bugs';
import StaleIssues from './pages/stale-issues';
import CommunityHealth from './pages/community-health';
import Settings from './pages/settings';
import RepositoryLayout from './layouts/repository-layout';

// Protected route wrapper
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/repos"
              element={
                <ProtectedRoute>
                  <RepoSelector />
                </ProtectedRoute>
              }
            />
            <Route
              path="/repos/:owner/:repo"
              element={
                <ProtectedRoute>
                  <RepositoryLayout />
                </ProtectedRoute>
              }
            >
              {/* Default redirect to bugs */}
              <Route index element={<Navigate to="bugs" replace />} />

              {/* Nested routes */}
              <Route path="bugs" element={<ImportantBugs />} />
              <Route path="stale" element={<StaleIssues />} />
              <Route path="community" element={<CommunityHealth />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="/" element={<Navigate to="/repos" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>

      {/* Dev tools - only in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;
