import React from 'react';

/**
 * Page component - Standardized page layout with title, description, and actions
 *
 * @param {Object} props
 * @param {string} props.title - Page title (h2)
 * @param {string} [props.description] - Optional description text below title
 * @param {React.ReactNode} [props.actions] - Optional action buttons (displayed top-right)
 * @param {React.ReactNode} props.children - Page content
 */
function Page({ title, description, actions, children }) {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '2rem'
      }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ marginBottom: description ? '0.5rem' : 0 }}>{title}</h2>
          {description && (
            <p style={{ color: '#666', margin: 0 }}>{description}</p>
          )}
        </div>
        {actions && (
          <div style={{ marginLeft: '1rem' }}>
            {actions}
          </div>
        )}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}

export default Page;
