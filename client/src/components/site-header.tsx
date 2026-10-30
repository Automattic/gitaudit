import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@wordpress/components';
import { useAuth } from '../context/auth-context';
import HeaderNavLink from '../layouts/shared/header-nav-link';

/** Pages leave this much room at the top for the fixed header. */
export const SITE_HEADER_HEIGHT = 57;

/**
 * Header shared by every page.
 */
function SiteHeader() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: SITE_HEADER_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #e0e0e0',
        padding: '0 2rem',
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          to="/"
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--wp-admin-theme-color)',
            letterSpacing: '-0.5px',
            textDecoration: 'none',
          }}
        >
          CodeVitals
        </Link>

        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <HeaderNavLink to="/repos">Repositories</HeaderNavLink>
            <span
              className="site-header__username"
              style={{ fontSize: '0.875rem', color: '#666', fontWeight: 500 }}
            >
              @{user?.username}
            </span>
            <Button variant="secondary" onClick={logout} size="compact">
              Logout
            </Button>
          </div>
        ) : (
          <Button variant="primary" onClick={() => navigate('/login')} size="compact">
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}

export default SiteHeader;
