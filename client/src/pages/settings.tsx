import { useParams, useNavigate } from 'react-router-dom';
import { Notice, Spinner } from '@wordpress/components';
import { useQuery } from '@tanstack/react-query';
import GeneralForm from './settings/general-form';
import MetricsForm from './settings/metrics-form';
import AdvancedForm from './settings/advanced-form';
import CollaboratorsForm from './settings/collaborators-form';
import { repoInfoQueryOptions } from '@/data/queries/metrics';
import { repoPermissionQueryOptions } from '@/data/queries/repos';
import Page from '../components/page';
import { Tabs } from '../utils/lock-unlock';

function Settings() {
  const { owner, repo, section } = useParams<{
    owner: string;
    repo: string;
    section: string;
  }>();
  const navigate = useNavigate();

  const { data: repoInfo, isLoading: isInfoLoading } = useQuery(repoInfoQueryOptions(owner!, repo!));
  const { data: permission, isLoading: isPermissionLoading } = useQuery(
    repoPermissionQueryOptions(owner!, repo!)
  );

  const pageTitle = 'Repository Settings';
  const pageDescription = 'Manage this repository and how its metrics are tracked';

  if (isInfoLoading || isPermissionLoading) {
    return (
      <Page title={pageTitle} description={pageDescription}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Spinner />
          <p style={{ marginTop: '1rem', color: '#666' }}>Loading settings...</p>
        </div>
      </Page>
    );
  }

  if (!permission?.isAdmin) {
    return (
      <Page title={pageTitle} description={pageDescription}>
        <Notice status="warning" isDismissible={false}>
          You need admin access to change this repository&apos;s settings.
        </Notice>
      </Page>
    );
  }

  if (!repoInfo) {
    return (
      <Page title={pageTitle} description={pageDescription}>
        <Notice status="error" isDismissible={false}>
          Failed to load settings. Please try again.
        </Notice>
      </Page>
    );
  }

  // Custom repos also manage their own info and collaborators; GitHub handles those otherwise
  const sections = repoInfo.isGithub
    ? ['metrics', 'advanced']
    : ['general', 'collaborators', 'metrics', 'advanced'];
  const activeSection = section && sections.includes(section) ? section : 'metrics';

  return (
    <Page title={pageTitle} description={pageDescription}>
      <Tabs
        selectedTabId={activeSection}
        onSelect={(tabId: string) => navigate(`/repos/${owner}/${repo}/settings/${tabId}`)}
      >
        <Tabs.TabList>
          {!repoInfo.isGithub && <Tabs.Tab tabId="general">General</Tabs.Tab>}
          {!repoInfo.isGithub && <Tabs.Tab tabId="collaborators">Collaborators</Tabs.Tab>}
          <Tabs.Tab tabId="metrics">Metrics</Tabs.Tab>
          <Tabs.Tab tabId="advanced">Advanced</Tabs.Tab>
        </Tabs.TabList>
      </Tabs>

      <div style={{ marginTop: '1.5rem' }}>
        {activeSection === 'general' && (
          <GeneralForm owner={owner!} repo={repo!} repoInfo={repoInfo} />
        )}
        {activeSection === 'collaborators' && <CollaboratorsForm owner={owner!} repo={repo!} />}
        {activeSection === 'metrics' && <MetricsForm owner={owner!} repo={repo!} />}
        {activeSection === 'advanced' && <AdvancedForm owner={owner!} repo={repo!} />}
      </div>
    </Page>
  );
}

export default Settings;
