import { useState } from 'react';
import {
  Card,
  CardBody,
  Button,
  Notice,
  Spinner,
  TextControl,
  CheckboxControl,
  ToggleControl,
  __experimentalNumberControl as NumberControl,
} from '@wordpress/components';
import { useQuery } from '@tanstack/react-query';
import {
  metricsQueryOptions,
  metricsTokenQueryOptions,
  metricsPublicStatusQueryOptions,
  useCreateMetricMutation,
  useUpdateMetricMutation,
  useDeleteMetricMutation,
  useRegenerateMetricsTokenMutation,
  useUpdateMetricsPublicStatusMutation,
} from '@/data/queries/metrics';
import { Metric } from '@/data/api/metrics/types';
import { getErrorMessage } from '@/utils/error-handling';
import ConfirmationModal from '@/components/confirmation-modal';

interface MetricsFormProps {
  owner: string;
  repo: string;
}

interface MetricFormState {
  key: string;
  name: string;
  unit: string;
  priority: number;
  defaultVisible: boolean;
}

const emptyMetricForm: MetricFormState = {
  key: '',
  name: '',
  unit: '',
  priority: 0,
  defaultVisible: true,
};

function MetricsForm({ owner, repo }: MetricsFormProps) {
  // Fetch metrics list
  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError,
  } = useQuery(metricsQueryOptions(owner, repo));

  // Fetch token status
  const {
    data: tokenStatus,
    isLoading: tokenLoading,
  } = useQuery(metricsTokenQueryOptions(owner, repo));

  // Fetch public status
  const {
    data: publicStatus,
    isLoading: publicStatusLoading,
  } = useQuery(metricsPublicStatusQueryOptions(owner, repo));

  // Mutations
  const createMutation = useCreateMetricMutation(owner, repo);
  const updatePublicStatusMutation = useUpdateMetricsPublicStatusMutation(owner, repo);
  const updateMutation = useUpdateMetricMutation(owner, repo);
  const deleteMutation = useDeleteMetricMutation(owner, repo);
  const regenerateTokenMutation = useRegenerateMetricsTokenMutation(owner, repo);

  // Local state
  const [isAddingMetric, setIsAddingMetric] = useState(false);
  const [editingMetricId, setEditingMetricId] = useState<number | null>(null);
  const [formState, setFormState] = useState<MetricFormState>(emptyMetricForm);
  const [deleteMetricId, setDeleteMetricId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // The actual token from the API (admin-only endpoint)
  const token = tokenStatus || null;

  // Get the metric being deleted
  const metricToDelete = deleteMetricId !== null
    ? metrics?.find(m => m.id === deleteMetricId)
    : null;

  // Validate key format
  const isKeyValid = /^[a-z][a-z0-9_]*$/.test(formState.key);
  const isNameValid = formState.name.trim().length > 0;

  function handleStartAdd() {
    setIsAddingMetric(true);
    setEditingMetricId(null);
    setFormState(emptyMetricForm);
    setError(null);
  }

  function handleStartEdit(metric: Metric) {
    setIsAddingMetric(false);
    setEditingMetricId(metric.id);
    setFormState({
      key: metric.key,
      name: metric.name,
      unit: metric.unit || '',
      priority: metric.priority,
      defaultVisible: metric.defaultVisible,
    });
    setError(null);
  }

  function handleCancelForm() {
    setIsAddingMetric(false);
    setEditingMetricId(null);
    setFormState(emptyMetricForm);
    setError(null);
  }

  async function handleSaveMetric() {
    setError(null);

    try {
      if (isAddingMetric) {
        await createMutation.mutateAsync({
          key: formState.key,
          name: formState.name.trim(),
          unit: formState.unit.trim() || undefined,
          priority: formState.priority,
          defaultVisible: formState.defaultVisible,
        });
        setSuccess('Metric created successfully');
      } else if (editingMetricId !== null) {
        await updateMutation.mutateAsync({
          id: editingMetricId,
          data: {
            name: formState.name.trim(),
            unit: formState.unit.trim() || undefined,
            priority: formState.priority,
            defaultVisible: formState.defaultVisible,
          },
        });
        setSuccess('Metric updated successfully');
      }

      handleCancelForm();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to save metric'));
    }
  }

  async function handleConfirmDelete() {
    if (deleteMetricId === null) return;

    setError(null);
    try {
      await deleteMutation.mutateAsync(deleteMetricId);
      setDeleteMetricId(null);
      setSuccess('Metric deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to delete metric'));
    }
  }

  async function handleRegenerateToken() {
    setError(null);

    try {
      await regenerateTokenMutation.mutateAsync();
      setSuccess('Token regenerated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to regenerate token'));
    }
  }

  function handleCopyToken() {
    if (token) {
      navigator.clipboard.writeText(token);
      setSuccess('Token copied to clipboard');
      setTimeout(() => setSuccess(null), 3000);
    }
  }

  async function handleTogglePublic() {
    const newValue = !publicStatus?.isPublic;
    setError(null);

    try {
      await updatePublicStatusMutation.mutateAsync(newValue);
      setSuccess(newValue ? 'Dashboard is now public' : 'Dashboard is now private');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to update public status'));
    }
  }

  function handleCopyPublicUrl() {
    const publicUrl = `${window.location.origin}/public/${owner}/${repo}/metrics`;
    navigator.clipboard.writeText(publicUrl);
    setSuccess('Public URL copied to clipboard');
    setTimeout(() => setSuccess(null), 3000);
  }

  if (metricsLoading || tokenLoading || publicStatusLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Spinner />
        <p style={{ marginTop: '0.5rem', color: '#666' }}>Loading metrics...</p>
      </div>
    );
  }

  if (metricsError) {
    return (
      <Notice status="error" isDismissible={false}>
        {getErrorMessage(metricsError, 'Failed to load metrics')}
      </Notice>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isFormOpen = isAddingMetric || editingMetricId !== null;

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

      {/* Metrics List */}
      <Card>
        <CardBody>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>Performance Metrics</h2>
              <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.875rem' }}>
                Define metrics to track from your CI/CD pipeline.
              </p>
            </div>
            {!isFormOpen && (
              <Button variant="primary" onClick={handleStartAdd}>
                Add Metric
              </Button>
            )}
          </div>

          {/* Add/Edit Form */}
          {isFormOpen && (
            <div style={{
              padding: '1rem',
              marginBottom: '1rem',
              backgroundColor: '#f6f7f7',
              borderRadius: '4px',
              border: '1px solid #ddd',
            }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>
                {isAddingMetric ? 'Add New Metric' : 'Edit Metric'}
              </h3>

              <div style={{ display: 'grid', gap: '1rem' }}>
                {isAddingMetric && (
                  <TextControl
                    label="Key"
                    help="Unique identifier (lowercase, letters/numbers/underscores only)"
                    value={formState.key}
                    onChange={(value) => setFormState(prev => ({ ...prev, key: value.toLowerCase() }))}
                    placeholder="e.g., bundle_size"
                  />
                )}

                <TextControl
                  label="Display Name"
                  value={formState.name}
                  onChange={(value) => setFormState(prev => ({ ...prev, name: value }))}
                  placeholder="e.g., Bundle Size"
                />

                <TextControl
                  label="Unit (optional)"
                  help="e.g., KB, ms, %"
                  value={formState.unit}
                  onChange={(value) => setFormState(prev => ({ ...prev, unit: value }))}
                  placeholder="e.g., KB"
                />

                <NumberControl
                  label="Priority"
                  help="Lower values appear first"
                  value={formState.priority}
                  onChange={(value) => setFormState(prev => ({ ...prev, priority: parseInt(value || '0', 10) }))}
                  min={0}
                  max={1000}
                />

                <CheckboxControl
                  label="Visible by default"
                  checked={formState.defaultVisible}
                  onChange={(value) => setFormState(prev => ({ ...prev, defaultVisible: value }))}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <Button
                  variant="primary"
                  onClick={handleSaveMetric}
                  disabled={isSaving || !isNameValid || (isAddingMetric && !isKeyValid)}
                  isBusy={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="secondary" onClick={handleCancelForm} disabled={isSaving}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Metrics Table */}
          {metrics && metrics.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Key</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Name</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Unit</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Priority</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Visible</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <code style={{ backgroundColor: '#f0f0f0', padding: '0.125rem 0.375rem', borderRadius: '3px' }}>
                        {metric.key}
                      </code>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{metric.name}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#666' }}>{metric.unit || '—'}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>{metric.priority}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      {metric.defaultVisible ? 'Yes' : 'No'}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                      <Button
                        variant="tertiary"
                        onClick={() => handleStartEdit(metric)}
                        disabled={isFormOpen}
                        size="small"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="tertiary"
                        isDestructive
                        onClick={() => setDeleteMetricId(metric.id)}
                        disabled={isFormOpen}
                        size="small"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#666',
              backgroundColor: '#f9f9f9',
              borderRadius: '4px',
            }}>
              <p style={{ margin: 0 }}>No metrics defined yet.</p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
                Add metrics to start tracking performance data from your CI/CD pipeline.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* API Token Section */}
      <Card style={{ marginTop: '1.5rem' }}>
        <CardBody>
          <h2 style={{ margin: '0 0 0.5rem 0' }}>API Token</h2>
          <p style={{ margin: '0 0 1rem 0', color: '#666', fontSize: '0.875rem' }}>
            Use this token to authenticate metric submissions from your CI/CD pipeline.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
              <strong style={{ flexShrink: 0 }}>Token:</strong>
              {token ? (
                <code style={{
                  backgroundColor: '#f0f0f0',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  wordBreak: 'break-all',
                  flex: 1,
                  minWidth: 0,
                }}>
                  {token}
                </code>
              ) : (
                <span style={{ color: '#999' }}>Not generated</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              {token && (
                <Button variant="secondary" onClick={handleCopyToken} size="small">
                  Copy
                </Button>
              )}
              <Button
                variant={token ? 'secondary' : 'primary'}
                onClick={handleRegenerateToken}
                disabled={regenerateTokenMutation.isPending}
                isBusy={regenerateTokenMutation.isPending}
                size="small"
              >
                {token ? 'Regenerate' : 'Generate Token'}
              </Button>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>Usage Example</h3>
            <pre style={{
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              padding: '1rem',
              borderRadius: '4px',
              fontSize: '0.8125rem',
              overflow: 'auto',
              margin: 0,
            }}>
{`curl -X POST "${window.location.origin}/api/log?token=YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "metrics": {
      "bundle_size": 1234567,
      "build_time": 45.2
    },
    "hash": "abc123def456",
    "branch": "main",
    "timestamp": "2024-01-15T10:30:00Z"
  }'`}
            </pre>
          </div>
        </CardBody>
      </Card>

      {/* Public Dashboard Section */}
      <Card style={{ marginTop: '1.5rem' }}>
        <CardBody>
          <h2 style={{ margin: '0 0 0.5rem 0' }}>Public Dashboard</h2>
          <p style={{ margin: '0 0 1rem 0', color: '#666', fontSize: '0.875rem' }}>
            Make your metrics dashboard publicly accessible without authentication.
            Only metrics marked as "Visible by default" will be shown publicly.
          </p>

          <ToggleControl
            label="Enable public dashboard"
            checked={publicStatus?.isPublic ?? false}
            onChange={handleTogglePublic}
            disabled={updatePublicStatusMutation.isPending}
          />

          {publicStatus?.isPublic && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: '#f0f6fc',
              borderRadius: '4px',
            }}>
              <strong>Public URL:</strong>
              <div style={{
                marginTop: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <code style={{
                  backgroundColor: '#fff',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '0.8125rem',
                  wordBreak: 'break-all',
                  flex: 1,
                  border: '1px solid #ddd',
                }}>
                  {`${window.location.origin}/public/${owner}/${repo}/metrics`}
                </code>
                <Button variant="secondary" onClick={handleCopyPublicUrl} size="small">
                  Copy
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Delete Confirmation Modal */}
      {deleteMetricId !== null && metricToDelete && (
        <ConfirmationModal
          title="Delete Metric"
          message={
            <p>
              Are you sure you want to delete the metric <strong>{metricToDelete.name}</strong> ({metricToDelete.key})?
              This will also delete all historical data for this metric.
            </p>
          }
          confirmLabel="Delete Metric"
          isDestructive
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteMetricId(null)}
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

export default MetricsForm;
