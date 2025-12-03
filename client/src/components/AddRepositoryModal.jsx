import React, { useState, useEffect } from 'react';
import { Modal, SearchControl, Button, Spinner, Notice, Card, CardBody } from '@wordpress/components';
import api from '../utils/api';

function AddRepositoryModal({ isOpen, onClose, onRepoAdded }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addingRepo, setAddingRepo] = useState(null); // Track which repo is being added

  // Fetch initial repositories on mount
  useEffect(() => {
    fetchInitialRepos();
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (searchTerm.length >= 3) {
      const timeoutId = setTimeout(() => {
        searchRepositories(searchTerm);
      }, 300); // 300ms debounce

      return () => clearTimeout(timeoutId);
    } else if (searchTerm.length === 0) {
      // Reset to initial repos when search is cleared
      fetchInitialRepos();
    }
  }, [searchTerm]);

  async function fetchInitialRepos() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get('/api/repos/browse?limit=12');
      setRepos(data.repos || []);
    } catch (err) {
      console.error('Error fetching repositories:', err);
      setError(err.message || 'Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  }

  async function searchRepositories(query) {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get(`/api/repos/search?q=${encodeURIComponent(query)}`);
      setRepos(data.repos || []);
      if (data.repos.length === 0) {
        setError('No repositories found matching your search');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to search repositories');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRepo(repo) {
    try {
      setAddingRepo(repo.databaseId);
      setError(null);

      await api.post('/api/repos/save', {
        owner: repo.owner.login,
        name: repo.name,
        githubId: repo.databaseId,
        description: repo.description,
        stars: repo.stargazerCount,
        language: repo.primaryLanguage?.name,
        languageColor: repo.primaryLanguage?.color,
        updatedAt: repo.updatedAt,
        isPrivate: repo.isPrivate
      });

      // Notify parent and close modal
      onRepoAdded();
      onClose();
    } catch (err) {
      console.error('Add repo error:', err);
      setError(err.message || 'Failed to add repository');
    } finally {
      setAddingRepo(null);
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
          onChange={setSearchTerm}
          placeholder="Search your repositories..."
          style={{ maxWidth: '400px', marginBottom: '2rem' }}
        />

        {error && (
          <Notice status="error" isDismissible={false} style={{ marginBottom: '1rem' }}>
            {error}
          </Notice>
        )}

        {loading ? (
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
                isAdding={addingRepo === repo.databaseId}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function RepositorySearchResult({ repo, onAdd, isAdding }) {
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
