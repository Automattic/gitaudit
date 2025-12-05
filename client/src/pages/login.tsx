import { useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button, Notice } from '@wordpress/components';
import { useAuth } from '../context/auth-context';
import Loading from '../components/loading';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading } = useAuth();
  const error = searchParams.get('error');

  // Get the location they were trying to access, or default to /repos
  const from = (location.state as any)?.from?.pathname || '/repos';

  useEffect(() => {
    // Only redirect if authenticated and actually on the login page
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Show loading state while checking authentication
  if (loading) {
    return <Loading fullScreen />;
  }

  const handleLogin = () => {
    // Redirect to GitHub OAuth
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    window.location.href = `${apiUrl}/auth/github`;
  };

  const errorMessages: Record<string, string> = {
    no_code: 'No authorization code received from GitHub',
    auth_failed: 'Authentication failed. Please try again.',
    session_expired: 'Your session has expired. Please sign in again.',
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <h1 style={{
          marginBottom: '2rem',
          fontSize: '2.5rem',
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: 'var(--wp-admin-theme-color)',
          letterSpacing: '-0.5px',
        }}>
          GitAudit
        </h1>
        <p style={{ marginBottom: '2rem', color: '#666' }}>
          Audit GitHub repository issues to identify important bugs,
          stale issues, duplicates, and triage needs.
        </p>

        {error && (
          <Notice status="error" isDismissible={false}>
            {errorMessages[error] || 'An error occurred during authentication'}
          </Notice>
        )}

        <Button variant="primary" onClick={handleLogin}>
          Sign in with GitHub
        </Button>
      </div>
    </div>
  );
}

export default Login;
