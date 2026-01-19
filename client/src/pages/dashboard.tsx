import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@wordpress/components';
import { repoStatusQueryOptions } from '@/data/queries/repos';
import Page from '../components/page';

function Dashboard() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();

  const { data: statusData, isLoading } = useQuery({
    ...repoStatusQueryOptions(owner!, repo!),
    refetchInterval: false,
  });

  useEffect(() => {
    if (isLoading || !statusData) return;

    // Redirect based on repo type
    if (statusData.isGithub) {
      // GitHub repos go to bugs page
      navigate(`/repos/${owner}/${repo}/bugs/all`, { replace: true });
    } else {
      // Non-GitHub repos go to settings
      navigate(`/repos/${owner}/${repo}/settings`, { replace: true });
    }
  }, [isLoading, statusData, owner, repo, navigate]);

  // Show loading while determining where to redirect
  return (
    <Page title="Loading...">
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Spinner />
      </div>
    </Page>
  );
}

export default Dashboard;
