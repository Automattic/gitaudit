import { useState } from 'react';
import { Button, Card, CardBody, Notice, TextControl, TextareaControl } from '@wordpress/components';
import { useUpdateLocalRepoMutation } from '@/data/queries/repos';
import type { RepoInfo } from '@/data/api/metrics/fetchers';
import { getErrorMessage } from '@/utils/error-handling';

interface GeneralFormProps {
  owner: string;
  repo: string;
  repoInfo: RepoInfo;
}

/**
 * Repository information for custom repos. GitHub repos get theirs from GitHub.
 */
function GeneralForm({ owner, repo, repoInfo }: GeneralFormProps) {
  const [url, setUrl] = useState(repoInfo.url ?? '');
  const [description, setDescription] = useState(repoInfo.description ?? '');
  const updateMutation = useUpdateLocalRepoMutation(owner, repo);

  return (
    <>
      {updateMutation.isError && (
        <div style={{ marginBottom: '1rem' }}>
          <Notice status="error" isDismissible={false}>
            {getErrorMessage(updateMutation.error, 'Failed to save repository')}
          </Notice>
        </div>
      )}
      {updateMutation.isSuccess && (
        <div style={{ marginBottom: '1rem' }}>
          <Notice status="success" isDismissible={false}>
            Repository saved.
          </Notice>
        </div>
      )}

      <Card>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <TextControl
              label="Repository URL"
              value={url}
              onChange={setUrl}
              help="Base URL for linking to commits"
              placeholder="https://github.com/org/repo"
            />
            <TextareaControl
              label="Description"
              value={description}
              onChange={setDescription}
              help="A brief description of this repository"
              placeholder="Enter a description..."
              rows={3}
            />
          </div>
        </CardBody>
      </Card>

      <div style={{ marginTop: '1.5rem' }}>
        <Button
          variant="primary"
          onClick={() => updateMutation.mutate({ url, description })}
          isBusy={updateMutation.isPending}
          disabled={updateMutation.isPending || !url.trim()}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </>
  );
}

export default GeneralForm;
