import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Page from '@/components/page';
import { MetricsDashboardContent } from '@/components/metrics-dashboard-content';
import { repoStatusQueryOptions } from '@/data/queries/repos';

/**
 * Authenticated metrics dashboard page (within RepositoryLayout)
 */
function MetricsDashboard() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();

  const { data: repoStatus } = useQuery(repoStatusQueryOptions(owner!, repo!));

  // Get repo URL for commit links
  const repoUrl =
    repoStatus?.url || (repoStatus?.isGithub ? `https://github.com/${owner}/${repo}` : undefined);

  return (
    <Page title="Performance Metrics" description="Track performance trends over time">
      <MetricsDashboardContent owner={owner!} repo={repo!} repoUrl={repoUrl} />
    </Page>
  );
}

export default MetricsDashboard;
