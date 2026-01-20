import { useNavigate } from 'react-router-dom';
import { Button } from '@wordpress/components';
import { useAuth } from '../context/auth-context';

/**
 * Shared header for public pages (homepage, public metrics dashboards)
 */
function PublicHeader() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #e0e0e0',
        padding: '0.75rem 2rem',
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          onClick={() => navigate('/')}
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--wp-admin-theme-color)',
            letterSpacing: '-0.5px',
            cursor: 'pointer',
          }}
        >
          GitAudit
        </span>

        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              onClick={() => navigate('/repos')}
              style={{
                fontSize: '0.875rem',
                color: '#666',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              @{user?.username}
            </span>
            <Button variant="secondary" onClick={logout} size="compact">
              Logout
            </Button>
          </div>
        ) : (
          <Button variant="primary" onClick={() => navigate('/login')}>
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}

export default PublicHeader;
