import { useState } from 'react';
import {
  Card,
  CardBody,
  Button,
  Notice,
  Spinner,
  TextControl,
  SelectControl,
} from '@wordpress/components';
import { useQuery } from '@tanstack/react-query';
import {
  collaboratorsQueryOptions,
  useAddCollaboratorMutation,
  useUpdateCollaboratorMutation,
  useRemoveCollaboratorMutation,
} from '@/data/queries/collaborators';
import { Collaborator } from '@/data/api/collaborators/types';
import { getErrorMessage } from '@/utils/error-handling';

interface CollaboratorsFormProps {
  owner: string;
  repo: string;
}

function CollaboratorsForm({ owner, repo }: CollaboratorsFormProps) {
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch collaborators
  const {
    data: collaboratorsData,
    isLoading,
    isError,
    error: fetchError,
  } = useQuery(collaboratorsQueryOptions(owner, repo));

  // Mutations
  const addMutation = useAddCollaboratorMutation(owner, repo);
  const updateMutation = useUpdateCollaboratorMutation(owner, repo);
  const removeMutation = useRemoveCollaboratorMutation(owner, repo);

  const collaborators = collaboratorsData?.collaborators ?? [];
  const adminCount = collaborators.filter((c) => c.role === 'admin').length;
  const isOnlyAdmin = (collab: Collaborator) =>
    collab.role === 'admin' && adminCount === 1;

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Handle adding a collaborator
  const handleAdd = async () => {
    if (!newUsername.trim()) {
      setError('Please enter a GitHub username');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await addMutation.mutateAsync({
        username: newUsername.trim(),
        role: newRole,
      });
      setNewUsername('');
      setNewRole('member');
      setSuccess(`Added ${newUsername.trim()} as ${newRole}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add collaborator'));
    }
  };

  // Handle updating a collaborator's role
  const handleUpdateRole = async (username: string, newRole: 'admin' | 'member') => {
    setError(null);
    setSuccess(null);

    try {
      await updateMutation.mutateAsync({ username, role: newRole });
      setSuccess(`Updated ${username} to ${newRole}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update role'));
    }
  };

  // Handle removing a collaborator
  const handleRemove = async (username: string) => {
    if (!window.confirm(`Remove ${username} from this repository?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await removeMutation.mutateAsync(username);
      setSuccess(`Removed ${username}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to remove collaborator'));
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Spinner />
        <p style={{ marginTop: '0.5rem', color: '#666' }}>Loading collaborators...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <Notice status="error" isDismissible={false}>
        {getErrorMessage(fetchError, 'Failed to load collaborators')}
      </Notice>
    );
  }

  const isMutating = addMutation.isPending || updateMutation.isPending || removeMutation.isPending;

  return (
    <div>
      {/* Success/Error Notices */}
      {success && (
        <div style={{ marginBottom: '1rem' }}>
          <Notice status="success" isDismissible onRemove={() => setSuccess(null)}>
            {success}
          </Notice>
        </div>
      )}
      {error && (
        <div style={{ marginBottom: '1rem' }}>
          <Notice status="error" isDismissible onRemove={() => setError(null)}>
            {error}
          </Notice>
        </div>
      )}

      {/* Add Collaborator Card */}
      <Card>
        <CardBody>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Add Collaborator</h2>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            Add team members by their GitHub username. They must have logged into this application
            at least once to be added.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
              <TextControl
                label="GitHub Username"
                value={newUsername}
                onChange={setNewUsername}
                placeholder="username"
                disabled={isMutating}
              />
            </div>
            <div style={{ flex: '0 0 150px' }}>
              <SelectControl
                label="Role"
                value={newRole}
                onChange={(value) => setNewRole(value as 'admin' | 'member')}
                options={[
                  { label: 'Member', value: 'member' },
                  { label: 'Admin', value: 'admin' },
                ]}
                disabled={isMutating}
              />
            </div>
            <div style={{ flex: '0 0 auto', paddingBottom: '8px' }}>
              <Button
                variant="primary"
                onClick={handleAdd}
                isBusy={addMutation.isPending}
                disabled={isMutating || !newUsername.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Collaborators List Card */}
      <Card style={{ marginTop: '1rem' }}>
        <CardBody>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Collaborators</h2>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            Manage who has access to this repository. Admins can modify settings and manage
            collaborators.
          </p>

          {collaborators.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No collaborators found.</p>
          ) : (
            <div>
              {/* Table Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 150px 120px 100px',
                  gap: '1rem',
                  padding: '0.75rem 0',
                  borderBottom: '2px solid #ddd',
                  fontWeight: 600,
                  color: '#1e1e1e',
                }}
              >
                <div>Username</div>
                <div>Role</div>
                <div>Added</div>
                <div>Actions</div>
              </div>

              {/* Collaborator Rows */}
              {collaborators.map((collab) => {
                const isLastAdmin = isOnlyAdmin(collab);

                return (
                  <div
                    key={collab.userId}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 150px 120px 100px',
                      gap: '1rem',
                      padding: '0.75rem 0',
                      borderBottom: '1px solid #eee',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 500 }}>{collab.username}</span>
                    </div>
                    <div>
                      <SelectControl
                        __nextHasNoMarginBottom
                        value={collab.role}
                        onChange={(value) =>
                          handleUpdateRole(collab.username, value as 'admin' | 'member')
                        }
                        options={[
                          { label: 'Member', value: 'member' },
                          { label: 'Admin', value: 'admin' },
                        ]}
                        disabled={isMutating || isLastAdmin}
                        title={isLastAdmin ? 'Cannot change role of the last admin' : undefined}
                      />
                    </div>
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>
                      {formatDate(collab.dateAdded)}
                    </div>
                    <div>
                      <Button
                        variant="tertiary"
                        isDestructive
                        size="small"
                        onClick={() => handleRemove(collab.username)}
                        disabled={isMutating || isLastAdmin}
                        title={isLastAdmin ? 'Cannot remove the last admin' : undefined}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {adminCount === 1 && collaborators.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <Notice status="info" isDismissible={false}>
                There must be at least one admin. Promote another user to admin before demoting or
                removing the current admin.
              </Notice>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default CollaboratorsForm;
