import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RepoProvider } from './context/RepoContext';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import RepoSelector from './pages/RepoSelector';
import ImportantBugs from './pages/ImportantBugs';
import StaleIssues from './pages/StaleIssues';
import Settings from './pages/Settings';
import RepositoryLayout from './layouts/RepositoryLayout';

// Protected route wrapper
function ProtectedRoute({ children }) {
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
    <AuthProvider>
      <RepoProvider>
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
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="/" element={<Navigate to="/repos" replace />} />
          </Routes>
        </BrowserRouter>
      </RepoProvider>
    </AuthProvider>
  );
}

export default App;
