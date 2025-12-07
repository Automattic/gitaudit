import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './data/queries/query-client';
import { AuthProvider, useAuth } from './context/auth-context';
import Login from './pages/login';
import AuthCallback from './pages/auth-callback';
import RepoSelector from './pages/repo-selector';
import Bugs from './pages/bugs';
import Stale from './pages/stale';
import Community from './pages/community';
import Features from './pages/features';
import Settings from './pages/settings';
import RepositoryLayout from './layouts/repository-layout';
import AppLayout from './layouts/app-layout';
import Loading from './components/loading';

// Protected route wrapper
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, token } = useAuth();
  const location = useLocation();

  // Show loading if we're checking auth or if we have a token but haven't verified it yet
  if (loading || (token && !isAuthenticated)) {
    return <Loading fullScreen />;
  }

  if (!isAuthenticated) {
    // Save the location they were trying to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/repos"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <RepoSelector />
                  </AppLayout>
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
              <Route index element={<Navigate to="bugs/all" replace />} />

              {/* Nested routes with tab parameters */}
              <Route path="bugs">
                <Route index element={<Navigate to="all" replace />} />
                <Route path=":tabId" element={<Bugs />} />
              </Route>
              <Route path="stale">
                <Route index element={<Navigate to="all" replace />} />
                <Route path=":tabId" element={<Stale />} />
              </Route>
              <Route path="community">
                <Route index element={<Navigate to="all" replace />} />
                <Route path=":tabId" element={<Community />} />
              </Route>
              <Route path="features">
                <Route index element={<Navigate to="all" replace />} />
                <Route path=":tabId" element={<Features />} />
              </Route>
              <Route path="settings">
                <Route index element={<Navigate to="bugs" replace />} />
                <Route path=":section" element={<Settings />} />
              </Route>
            </Route>
            <Route path="/" element={<Navigate to="/repos" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>

      {/* Dev tools - only in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;
