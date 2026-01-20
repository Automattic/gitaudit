import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, Button, Notice, Spinner } from '@wordpress/components';
import { useQuery } from '@tanstack/react-query';
import { repoPermissionQueryOptions, useFullDeleteRepoMutation } from '@/data/queries/repos';
import { getErrorMessage } from '@/utils/error-handling';
import ConfirmationModal from '@/components/confirmation-modal';

interface AdvancedFormProps {
  owner: string;
  repo: string;
}

function AdvancedForm({ owner, repo }: AdvancedFormProps) {
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Check if user has admin permission
  const { data: permission, isLoading: permissionLoading } = useQuery(
    repoPermissionQueryOptions(owner, repo)
  );

  const deleteMutation = useFullDeleteRepoMutation();

  const isAdmin = permission?.isAdmin ?? false;
  const repoFullName = `${owner}/${repo}`;

  async function handleConfirmDelete() {
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync({ owner, repo });
      setShowDeleteModal(false);
      navigate('/repos');
    } catch (err: unknown) {
      setDeleteError(getErrorMessage(err, 'Failed to delete repository'));
    }
  }

  if (permissionLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Spinner />
        <p style={{ marginTop: '0.5rem', color: '#666' }}>Checking permissions...</p>
      </div>
    );
  }

  return (
    <div>
      <Card>
        <CardBody>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#d63638' }}>
            Danger Zone
          </h2>
          <p style={{ marginBottom: '1.5rem', color: '#666' }}>
            These actions are destructive and cannot be undone.
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1.5rem',
            }}
          >
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
                Remove Repository
              </h3>
              <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>
                Delete this repository from CodeVitals and remove all associated data including
                cached issues, pull requests, analysis results, and settings.
              </p>
            </div>

            {isAdmin ? (
              <Button
                variant="primary"
                isDestructive
                onClick={() => setShowDeleteModal(true)}
                style={{ flexShrink: 0 }}
              >
                Remove Repository
              </Button>
            ) : (
              <Notice status="warning" isDismissible={false}>
                Admin access required
              </Notice>
            )}
          </div>

          {!isAdmin && (
            <div style={{ marginTop: '1rem' }}>
              <Notice status="info" isDismissible={false}>
                You need admin permissions on this GitHub repository to remove it from CodeVitals.
              </Notice>
            </div>
          )}
        </CardBody>
      </Card>

      {showDeleteModal && (
        <ConfirmationModal
          title="Remove Repository"
          message={
            <div>
              <p style={{ marginTop: 0 }}>
                Are you sure you want to remove <strong>{repoFullName}</strong> from CodeVitals?
              </p>
              <p>This will permanently delete:</p>
              <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                <li>All cached issues and pull requests</li>
                <li>All analysis results (sentiment, staleness, etc.)</li>
                <li>All scoring data and settings for this repository</li>
              </ul>
              <p style={{ marginBottom: 0, fontWeight: 600 }}>
                This action cannot be undone.
              </p>
            </div>
          }
          confirmLabel="Remove Repository"
          confirmationText={repoFullName}
          isDestructive
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setShowDeleteModal(false);
            setDeleteError(null);
          }}
          isLoading={deleteMutation.isPending}
          error={deleteError}
        />
      )}
    </div>
  );
}

export default AdvancedForm;
