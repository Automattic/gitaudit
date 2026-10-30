import type { ReactNode } from 'react';

/**
 * Page component - Standardized page layout with title, description, and actions
 */
interface PageProps {
  /** Page title (h2) */
  title: string;
  /** Optional description text below title */
  description?: string;
  /** Optional action buttons (displayed top-right) */
  actions?: ReactNode;
  /** Page content */
  children: ReactNode;
}

function Page({ title, description, actions, children }: PageProps) {
  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '1264px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem 1rem',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '1.5rem'
      }}>
        <div style={{ flex: '1 1 260px' }}>
          <h2 style={{ marginBottom: description ? '0.5rem' : 0 }}>{title}</h2>
          {description && (
            <p style={{ color: '#666', margin: 0, fontSize: '0.9rem' }}>{description}</p>
          )}
        </div>
        {actions && <div>{actions}</div>}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}

export default Page;
