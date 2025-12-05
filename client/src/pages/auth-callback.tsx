import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import Loading from '../components/loading';

function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      navigate('/login?error=' + error);
      return;
    }

    if (token) {
      // Store token and redirect to repos page
      login(token); // User data will be fetched by AuthContext
      navigate('/repos');
    } else {
      navigate('/login');
    }
  }, [searchParams, login, navigate]);

  return <Loading fullScreen />;
}

export default AuthCallback;
