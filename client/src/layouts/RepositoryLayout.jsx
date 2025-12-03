import React from 'react';
import { useParams, useNavigate, Outlet, NavLink } from 'react-router-dom';
import { Button } from '@wordpress/components';
import { useAuth } from '../context/AuthContext';

function RepositoryLayout() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f0f0' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #ddd',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', cursor: 'pointer' }} onClick={() => navigate('/repos')}>
            GitAudit
          </h1>
          <span style={{ color: '#999' }}>/</span>
          <span style={{ color: '#666', fontWeight: 500 }}>{owner}/{repo}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#666' }}>@{user?.username}</span>
          <Button variant="secondary" onClick={logout}>
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content Area with Sidebar */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 65px)' }}>
        {/* Left Sidebar */}
        <aside style={{
          width: '220px',
          backgroundColor: 'white',
          borderRight: '1px solid #ddd',
          padding: '1.5rem 0',
        }}>
          <nav>
            <NavLink
              to={`/repos/${owner}/${repo}/bugs`}
              style={({ isActive }) => ({
                display: 'block',
                padding: '0.75rem 1.5rem',
                color: isActive ? '#2271b1' : '#50575e',
                backgroundColor: isActive ? '#f0f6fc' : 'transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 600 : 400,
                borderLeft: isActive ? '3px solid #2271b1' : '3px solid transparent',
              })}
            >
              Important Bugs
            </NavLink>
            <NavLink
              to={`/repos/${owner}/${repo}/settings`}
              style={({ isActive }) => ({
                display: 'block',
                padding: '0.75rem 1.5rem',
                color: isActive ? '#2271b1' : '#50575e',
                backgroundColor: isActive ? '#f0f6fc' : 'transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 600 : 400,
                borderLeft: isActive ? '3px solid #2271b1' : '3px solid transparent',
              })}
            >
              Settings
            </NavLink>
          </nav>
        </aside>

        {/* Right Content Area */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default RepositoryLayout;
