import { useState, useMemo, useCallback } from 'react';
import { Modal, SearchControl, Button, Notice, Card, CardBody, TextControl, TextareaControl, TabPanel } from '@wordpress/components';
import { DataForm } from '@wordpress/dataviews';
import { useDebounce } from '@wordpress/compose';
import { useQuery } from '@tanstack/react-query';
import { repoBrowseQueryOptions, repoSearchQueryOptions, useSaveRepoMutation, useCreateLocalRepoMutation } from '@/data/queries/repos';
import { GitHubRepo } from '@/data/api/repos/types';
import { getErrorMessage } from '@/utils/error-handling';
import Loading from './loading';

interface AddRepositoryModalProps {
  onClose: () => void;
  onRepoAdded: () => void;
}

function AddRepositoryModal({ onClose, onRepoAdded }: AddRepositoryModalProps) {
  return (
    <Modal
      title="Add Repository"
      onRequestClose={onClose}
      isFullScreen
    >
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <TabPanel
          tabs={[
            { name: 'github', title: 'GitHub Repository' },
            { name: 'custom', title: 'Custom Repository' },
          ]}
        >
          {(tab) => tab.name === 'github' ? (
            <GitHubRepoTab onClose={onClose} onRepoAdded={onRepoAdded} />
          ) : (
            <CustomRepoTab onClose={onClose} onRepoAdded={onRepoAdded} />
          )}
        </TabPanel>
      </div>
    </Modal>
  );
}

interface TabProps {
  onClose: () => void;
  onRepoAdded: () => void;
}

function GitHubRepoTab({ onClose, onRepoAdded }: TabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSetSearch = useDebounce((value: string) => {
    setSearchTerm(value);
  }, 300);

  // Conditional queries - only one will be active at a time
  const browseQuery = useQuery({
    ...repoBrowseQueryOptions(12),
    enabled: searchTerm.length === 0,
  });

  const searchQuery = useQuery({
    ...repoSearchQueryOptions(searchTerm),
    enabled: searchTerm.length >= 3,
  });

  // Mutation for adding a repo
  const saveRepoMutation = useSaveRepoMutation();

  // Determine which query is active
  const activeQuery = searchTerm.length >= 3 ? searchQuery : browseQuery;
  const repos = activeQuery.data?.repos ?? [];
  const isLoading = activeQuery.isLoading;
  const error = activeQuery.error;

  async function handleAddRepo(repo: GitHubRepo) {
    try {
      await saveRepoMutation.mutateAsync({
        owner: repo.owner.login,
        name: repo.name,
        githubId: repo.databaseId,
        description: repo.description,
        stars: repo.stargazerCount,
        language: repo.primaryLanguage?.name ?? null,
        languageColor: repo.primaryLanguage?.color ?? null,
        updatedAt: repo.updatedAt,
        isPrivate: repo.isPrivate
      });

      // Notify parent and close modal
      onRepoAdded();
      onClose();
    } catch (err) {
      console.error('Add repo error:', err);
      // Error is handled by the mutation itself
    }
  }

  return (
    <div style={{ paddingTop: '1.5rem' }}>
      <SearchControl
        value={searchTerm}
        onChange={debouncedSetSearch}
        placeholder="Search your repositories..."
        style={{ maxWidth: '400px', marginBottom: '2rem' }}
      />

      {error && (
        <div style={{ marginBottom: '1rem' }}>
          <Notice status="error" isDismissible={false}>
            {getErrorMessage(error, 'Failed to fetch repositories')}
          </Notice>
        </div>
      )}

      {saveRepoMutation.isError && (
        <div style={{ marginBottom: '1rem' }}>
          <Notice status="error" isDismissible={false}>
            {getErrorMessage(saveRepoMutation.error, 'Failed to add repository')}
          </Notice>
        </div>
      )}

      {isLoading ? (
        <Loading />
      ) : repos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
          <p>{searchTerm ? 'No repositories found matching your search' : 'No repositories found'}</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '1rem',
        }}>
          {repos.map(repo => (
            <RepositorySearchResult
              key={repo.databaseId}
              repo={repo}
              onAdd={handleAddRepo}
              isAdding={saveRepoMutation.isPending && saveRepoMutation.variables?.githubId === repo.databaseId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type CustomRepoFormData = {
  name: string;
  url: string;
  description: string;
};

interface FieldEditProps {
  data: CustomRepoFormData;
  field: { id: string; label: string };
  onChange: (updates: Partial<CustomRepoFormData>) => void;
}

function CustomRepoTab({ onClose, onRepoAdded }: TabProps) {
  const [formData, setFormData] = useState<CustomRepoFormData>({
    name: '',
    url: '',
    description: '',
  });

  const createLocalRepoMutation = useCreateLocalRepoMutation();

  const handleChange = useCallback((edits: Partial<CustomRepoFormData>) => {
    setFormData(prev => ({ ...prev, ...edits }));
  }, []);

  async function handleSubmit() {
    if (!formData.name.trim() || !formData.url.trim()) {
      return;
    }

    try {
      await createLocalRepoMutation.mutateAsync({
        name: formData.name.trim(),
        url: formData.url.trim(),
        description: formData.description.trim() || undefined,
      });

      // Notify parent and close modal
      onRepoAdded();
      onClose();
    } catch (err) {
      console.error('Create local repo error:', err);
      // Error is handled by the mutation itself
    }
  }

  const fields = useMemo(() => [
    {
      id: 'name',
      type: 'text' as const,
      label: 'Name',
      Edit: ({ data, field, onChange }: FieldEditProps) => (
        <TextControl
          label={field.label}
          value={data.name}
          onChange={(value) => onChange({ name: value })}
          placeholder="my-repository"
          help="Display name for this repository"
        />
      ),
    },
    {
      id: 'url',
      type: 'text' as const,
      label: 'URL',
      Edit: ({ data, field, onChange }: FieldEditProps) => (
        <TextControl
          label={field.label}
          value={data.url}
          onChange={(value) => onChange({ url: value })}
          placeholder="https://github.com/org/repo"
          help="Base URL for linking to commits (e.g., https://github.com/org/repo)"
        />
      ),
    },
    {
      id: 'description',
      type: 'text' as const,
      label: 'Description (optional)',
      Edit: ({ data, field, onChange }: FieldEditProps) => (
        <TextareaControl
          label={field.label}
          value={data.description}
          onChange={(value) => onChange({ description: value })}
          placeholder="A short description of this repository..."
        />
      ),
    },
  ], []);

  const form = useMemo(() => ({
    fields: ['name', 'url', 'description'],
  }), []);

  return (
    <div style={{ paddingTop: '1.5rem', maxWidth: '500px' }}>
      {createLocalRepoMutation.isError && (
        <div style={{ marginBottom: '1rem' }}>
          <Notice status="error" isDismissible={false}>
            {getErrorMessage(createLocalRepoMutation.error, 'Failed to create repository')}
          </Notice>
        </div>
      )}

      <DataForm
        data={formData}
        fields={fields}
        form={form}
        onChange={handleChange}
      />

      <div style={{ marginTop: '1.5rem' }}>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!formData.name.trim() || !formData.url.trim() || createLocalRepoMutation.isPending}
        >
          {createLocalRepoMutation.isPending ? 'Creating...' : 'Create Repository'}
        </Button>
      </div>
    </div>
  );
}

interface RepositorySearchResultProps {
  repo: GitHubRepo;
  onAdd: (repo: GitHubRepo) => void;
  isAdding: boolean;
}

function RepositorySearchResult({ repo, onAdd, isAdding }: RepositorySearchResultProps) {
  return (
    <Card>
      <CardBody>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--wp-admin-theme-color)',
              marginBottom: '0.25rem'
            }}>
              {repo.owner.login}/{repo.name}
            </h3>

            {repo.description && (
              <p style={{
                margin: '0.25rem 0',
                fontSize: '0.875rem',
                color: '#666',
                lineHeight: 1.4
              }}>
                {repo.description.length > 100
                  ? repo.description.substring(0, 100) + '...'
                  : repo.description}
              </p>
            )}

            <div style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#666'
            }}>
              {repo.primaryLanguage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: repo.primaryLanguage.color || '#ccc'
                    }}
                  />
                  {repo.primaryLanguage.name}
                </div>
              )}
              <div>⭐ {repo.stargazerCount}</div>
              {repo.isPrivate && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 6px',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '3px'
                }}>
                  Private
                </span>
              )}
            </div>
          </div>

          <Button
            variant="primary"
            onClick={() => onAdd(repo)}
            disabled={isAdding}
          >
            {isAdding ? 'Adding...' : 'Add'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export default AddRepositoryModal;
