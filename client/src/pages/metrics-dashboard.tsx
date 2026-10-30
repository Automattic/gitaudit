import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Page from '@/components/page';
import { MetricsDashboardContent } from '@/components/metrics-dashboard-content';
import { repoInfoQueryOptions } from '@/data/queries/metrics';

/**
 * Authenticated metrics dashboard page (within RepositoryLayout)
 */
function MetricsDashboard() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();

  const { data: repoInfo } = useQuery(repoInfoQueryOptions(owner!, repo!));

  // Get repo URL for commit links
  const repoUrl =
    repoInfo?.url || (repoInfo?.isGithub ? `https://github.com/${owner}/${repo}` : undefined);

  return (
    <Page title="Performance Metrics" description="Track performance trends over time">
      <MetricsDashboardContent owner={owner!} repo={repo!} repoUrl={repoUrl} />
    </Page>
  );
}

export default MetricsDashboard;
