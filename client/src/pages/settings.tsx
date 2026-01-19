import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Notice, Spinner } from '@wordpress/components';
import { useQuery } from '@tanstack/react-query';
import GeneralForm from './settings/general-form';
import ImportantBugsForm from './settings/important-bugs-form';
import StaleIssuesForm from './settings/stale-issues-form';
import CommunityHealthForm from './settings/community-health-form';
import FeatureRequestForm from './settings/features-form';
import StalePRsForm from './settings/stale-prs-form';
import AdvancedForm from './settings/advanced-form';
import { repoSettingsQueryOptions, useUpdateSettingsMutation, useResetSettingsMutation } from '@/data/queries/settings';
import { repoStatusQueryOptions, useUpdateLocalRepoMutation } from '@/data/queries/repos';
import { RepoSettings } from '@/data/api/settings/types';
import { getErrorMessage } from '@/utils/error-handling';
import Page from '../components/page';
import { Tabs } from '../utils/lock-unlock';

function Settings() {
  const { owner, repo, section } = useParams<{
    owner: string;
    repo: string;
    section: string;
  }>();
  const navigate = useNavigate();

  // Get repo status to determine if it's a GitHub repo
  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    ...repoStatusQueryOptions(owner!, repo!),
    refetchInterval: false, // Don't poll for settings purposes
  });

  const isGithub = statusData?.isGithub ?? true; // Default to true for backward compat

  // Validate section parameter with fallback - custom repos have "general" and "advanced"
  const validSections = isGithub
    ? ["general", "bugs", "stale", "community", "features", "stalePRs", "advanced"]
    : ["general", "advanced"];
  const activeSection = section && validSections.includes(section)
    ? section
    : "general";

  // Redirect to general if custom repo tries to access GitHub-specific tabs
  useEffect(() => {
    if (!isGithub && section && !validSections.includes(section)) {
      navigate(`/repos/${owner}/${repo}/settings/general`, { replace: true });
    }
  }, [isGithub, section, owner, repo, navigate, validSections]);

  // Fetch settings using TanStack Query
  const { data: serverSettings, isLoading: isSettingsLoading } = useQuery(
    repoSettingsQueryOptions(owner!, repo!)
  );

  // Local state for editing (null means no edits yet, fallback to server)
  const [localSettingsState, setLocalSettingsState] = useState<RepoSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Local state for repo info (custom repos only)
  const [repoInfo, setRepoInfo] = useState<{ url: string; description: string }>({
    url: statusData?.url || '',
    description: statusData?.description || '',
  });

  // Track form validity for custom repos
  const [isFormValid, setIsFormValid] = useState(true);

  // Update repoInfo when statusData changes
  useEffect(() => {
    if (statusData && !isGithub) {
      setRepoInfo({
        url: statusData.url || '',
        description: statusData.description || '',
      });
    }
  }, [statusData, isGithub]);

  // Mutations
  const updateMutation = useUpdateSettingsMutation(owner!, repo!);
  const resetMutation = useResetSettingsMutation(owner!, repo!);
  const updateRepoMutation = useUpdateLocalRepoMutation(owner!, repo!);

  const isLoading = isStatusLoading || isSettingsLoading;

  // Use local settings if edited, otherwise use server settings
  const localSettings = localSettingsState ?? serverSettings;

  // Helper to handle settings mutation errors
  const handleSettingsError = (err: any, action: string) => {
    console.error(`Failed to ${action} settings:`, err);
    if (err?.status === 403) {
      setError(`You need admin permissions on this repository to ${action} settings.`);
    } else {
      setError(getErrorMessage(err, `Failed to ${action} settings`));
    }
  };

  async function handleSave() {
    if (!localSettings) return;

    try {
      setError(null);
      setSuccess(false);

      // For custom repos, save repo info if on general tab
      if (!isGithub && activeSection === 'general') {
        await updateRepoMutation.mutateAsync(repoInfo);
      }

      // Save settings (for GitHub repos, or general settings for custom repos)
      if (isGithub || localSettingsState) {
        await updateMutation.mutateAsync(localSettings);
        setLocalSettingsState(null); // Clear local edits after save, fallback to updated server settings
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      handleSettingsError(err, 'save');
    }
  }

  // Handler for repo info changes (custom repos only)
  function handleRepoInfoChange(field: 'url' | 'description', value: string) {
    setRepoInfo(prev => ({ ...prev, [field]: value }));
  }

  // Handler for form validity changes (custom repos only)
  function handleValidityChange(valid: boolean) {
    setIsFormValid(valid);
  }

  async function handleReset() {
    if (!window.confirm('Reset all settings to defaults? This cannot be undone.'))
      return;

    try {
      setError(null);
      setSuccess(false);
      await resetMutation.mutateAsync();
      setLocalSettingsState(null); // Clear local edits, will fallback to server
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      handleSettingsError(err, 'reset');
    }
  }

  // Callbacks for child components
  function handleGeneralChange(updatedSettings: RepoSettings) {
    setLocalSettingsState(updatedSettings);
  }

  function handleImportantBugsChange(updatedBugs: RepoSettings['bugs']) {
    setLocalSettingsState((prev) => ({
      ...(prev ?? serverSettings!),
      bugs: updatedBugs,
    }));
  }

  function handleStaleIssuesChange(updatedStale: RepoSettings['stale']) {
    setLocalSettingsState((prev) => ({
      ...(prev ?? serverSettings!),
      stale: updatedStale,
    }));
  }

  function handleCommunityHealthChange(updatedCommunity: RepoSettings['community']) {
    setLocalSettingsState((prev) => ({
      ...(prev ?? serverSettings!),
      community: updatedCommunity,
    }));
  }

  function handleFeatureRequestChange(updatedFeatures: RepoSettings['features']) {
    setLocalSettingsState((prev) => ({
      ...(prev ?? serverSettings!),
      features: updatedFeatures,
    }));
  }

  function handleStalePRsChange(updatedStalePRs: RepoSettings['stalePRs']) {
    setLocalSettingsState((prev) => ({
      ...(prev ?? serverSettings!),
      stalePRs: updatedStalePRs,
    }));
  }

  if (isLoading) {
    return (
      <Page title="Scoring Settings">
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Spinner />
          <p style={{ marginTop: '1rem', color: '#666' }}>Loading settings...</p>
        </div>
      </Page>
    );
  }

  if (!localSettings) {
    return (
      <Page title="Scoring Settings">
        <Notice status="error" isDismissible={false}>
          Failed to load settings. Please try again.
        </Notice>
      </Page>
    );
  }

  const saving = updateMutation.isPending || resetMutation.isPending || updateRepoMutation.isPending;

  // Page title and description based on repo type
  const pageTitle = isGithub ? "Scoring Settings" : "Repository Settings";
  const pageDescription = isGithub
    ? "Configure how issues are scored and prioritized"
    : "Manage your custom repository settings";

  return (
    <Page
      title={pageTitle}
      description={pageDescription}
    >
      {/* Success/Error Notices */}
      {success && (
        <div style={{ marginBottom: '1rem' }}>
          <Notice
            status="success"
            isDismissible
            onRemove={() => setSuccess(false)}
          >
            Settings saved successfully!
          </Notice>
        </div>
      )}
      {error && (
        <div style={{ marginBottom: '1rem' }}>
          <Notice
            status="error"
            isDismissible
            onRemove={() => setError(null)}
          >
            {error}
          </Notice>
        </div>
      )}

      <Tabs
        selectedTabId={activeSection}
        onSelect={(tabId: string) => navigate(`/repos/${owner}/${repo}/settings/${tabId}`)}
      >
        <Tabs.TabList>
          <Tabs.Tab tabId="general">General</Tabs.Tab>
          {isGithub && (
            <>
              <Tabs.Tab tabId="bugs">Important Bugs</Tabs.Tab>
              <Tabs.Tab tabId="stale">Stale Issues</Tabs.Tab>
              <Tabs.Tab tabId="features">Feature Requests</Tabs.Tab>
              <Tabs.Tab tabId="community">Community Health</Tabs.Tab>
              <Tabs.Tab tabId="stalePRs">Stale PRs</Tabs.Tab>
            </>
          )}
          <Tabs.Tab tabId="advanced">Advanced</Tabs.Tab>
        </Tabs.TabList>
      </Tabs>

      <div style={{ marginTop: '1.5rem' }}>
        {activeSection === "general" && (
          <GeneralForm
            settings={localSettings}
            onChange={handleGeneralChange}
            isGithub={isGithub}
            repoInfo={repoInfo}
            onRepoInfoChange={handleRepoInfoChange}
            onValidityChange={handleValidityChange}
          />
        )}
        {activeSection === "bugs" && (
          <ImportantBugsForm
            settings={localSettings.bugs}
            onChange={handleImportantBugsChange}
          />
        )}
        {activeSection === "stale" && (
          <StaleIssuesForm
            settings={localSettings.stale}
            onChange={handleStaleIssuesChange}
          />
        )}
        {activeSection === "community" && (
          <CommunityHealthForm
            settings={localSettings.community}
            onChange={handleCommunityHealthChange}
          />
        )}
        {activeSection === "features" && (
          <FeatureRequestForm
            settings={localSettings.features}
            onChange={handleFeatureRequestChange}
          />
        )}
        {activeSection === "stalePRs" && (
          <StalePRsForm
            settings={localSettings.stalePRs}
            onChange={handleStalePRsChange}
          />
        )}
        {activeSection === "advanced" && (
          <AdvancedForm owner={owner!} repo={repo!} />
        )}
      </div>

      {/* Action Buttons (outside card, shared for all tabs except Advanced) */}
      {activeSection !== "advanced" && (
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
          <Button variant="primary" onClick={handleSave} isBusy={saving} disabled={saving || (!isGithub && !isFormValid)}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
          {isGithub && (
            <Button variant="secondary" onClick={handleReset} disabled={saving}>
              Reset to Defaults
            </Button>
          )}
        </div>
      )}
    </Page>
  );
}

export default Settings;
