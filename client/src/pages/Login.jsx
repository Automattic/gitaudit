import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, CardBody, Notice } from '@wordpress/components';
import { useAuth } from '../context/AuthContext';

function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const error = searchParams.get('error');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/repos');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = () => {
    // Redirect to GitHub OAuth
    window.location.href = 'http://localhost:3001/auth/github';
  };

  const errorMessages = {
    no_code: 'No authorization code received from GitHub',
    auth_failed: 'Authentication failed. Please try again.',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <Card style={{ maxWidth: '400px', width: '100%' }}>
        <CardBody>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ marginBottom: '1rem' }}>GitAudit</h1>
            <p style={{ marginBottom: '2rem', color: '#666' }}>
              Audit GitHub repository issues to identify important bugs,
              stale issues, duplicates, and triage needs.
            </p>

            {error && (
              <Notice status="error" isDismissible={false} style={{ marginBottom: '1rem', textAlign: 'left' }}>
                {errorMessages[error] || 'An error occurred during authentication'}
              </Notice>
            )}

            <Button variant="primary" onClick={handleLogin} style={{ width: '100%' }}>
              Sign in with GitHub
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default Login;
