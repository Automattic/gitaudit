import { useState } from 'react';
import { Modal, SearchControl, Button, Spinner, Notice, Card, CardBody } from '@wordpress/components';
import { useDebounce } from '@wordpress/compose';
import { useQuery } from '@tanstack/react-query';
import { repoBrowseQueryOptions, repoSearchQueryOptions, useSaveRepoMutation } from '@/data/queries/repos';
import { GitHubRepo } from '@/data/api/repos/types';

interface AddRepositoryModalProps {
  onClose: () => void;
  onRepoAdded: () => void;
}

function AddRepositoryModal({ onClose, onRepoAdded }: AddRepositoryModalProps) {
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
    <Modal
      title="Add Repository"
      onRequestClose={onClose}
      isFullScreen
    >
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <SearchControl
          value={searchTerm}
          onChange={debouncedSetSearch}
          placeholder="Search your repositories..."
          style={{ maxWidth: '400px', marginBottom: '2rem' }}
        />

        {error && (
          <div style={{ marginBottom: '1rem' }}>
            <Notice status="error" isDismissible={false}>
              {error instanceof Error ? error.message : 'Failed to fetch repositories'}
            </Notice>
          </div>
        )}

        {saveRepoMutation.isError && (
          <div style={{ marginBottom: '1rem' }}>
            <Notice status="error" isDismissible={false}>
              {saveRepoMutation.error instanceof Error
                ? saveRepoMutation.error.message
                : 'Failed to add repository'}
            </Notice>
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Spinner />
            <p style={{ marginTop: '1rem', color: '#666' }}>
              {searchTerm ? 'Searching GitHub...' : 'Loading repositories...'}
            </p>
          </div>
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
    </Modal>
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
              color: '#0073aa',
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
