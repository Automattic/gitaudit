import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { TabPanel, Button, Notice, Spinner } from '@wordpress/components';
import { useQuery } from '@tanstack/react-query';
import ImportantBugsForm from './settings/important-bugs-form';
import StaleIssuesForm from './settings/stale-issues-form';
import CommunityHealthForm from './settings/community-health-form';
import { repoSettingsQueryOptions, useUpdateSettingsMutation, useResetSettingsMutation } from '@/data/queries/settings';
import { RepoSettings } from '@/data/api/settings/types';
import Page from '../components/page';

function Settings() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();

  // Fetch settings using TanStack Query
  const { data: serverSettings, isLoading } = useQuery(
    repoSettingsQueryOptions(owner!, repo!)
  );

  // Local state for editing (null means no edits yet, fallback to server)
  const [localSettingsState, setLocalSettingsState] = useState<RepoSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Mutations
  const updateMutation = useUpdateSettingsMutation(owner!, repo!);
  const resetMutation = useResetSettingsMutation(owner!, repo!);

  // Use local settings if edited, otherwise use server settings
  const localSettings = localSettingsState ?? serverSettings;

  async function handleSave() {
    if (!localSettings) return;

    try {
      setError(null);
      setSuccess(false);
      await updateMutation.mutateAsync(localSettings);
      setLocalSettingsState(null); // Clear local edits after save, fallback to updated server settings
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save settings'
      );
    }
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
    } catch (err) {
      console.error('Failed to reset settings:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to reset settings'
      );
    }
  }

  // Callbacks for child components
  function handleImportantBugsChange(updatedImportantBugs: RepoSettings['importantBugs']) {
    setLocalSettingsState((prev) => ({
      ...(prev ?? serverSettings!),
      importantBugs: updatedImportantBugs,
    }));
  }

  function handleStaleIssuesChange(updatedStaleIssues: RepoSettings['staleIssues']) {
    setLocalSettingsState((prev) => ({
      ...(prev ?? serverSettings!),
      staleIssues: updatedStaleIssues,
    }));
  }

  function handleCommunityHealthChange(updatedCommunityHealth: RepoSettings['communityHealth']) {
    setLocalSettingsState((prev) => ({
      ...(prev ?? serverSettings!),
      communityHealth: updatedCommunityHealth,
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

  const saving = updateMutation.isPending || resetMutation.isPending;

  return (
    <Page
      title="Scoring Settings"
      description="Configure how issues are scored and prioritized"
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

      {/* @ts-ignore - External library type error */}
      <TabPanel
        className="settings-tabs"
        activeClass="is-active"
        tabs={[
          { name: 'important-bugs', title: 'Important Bugs' },
          { name: 'stale-issues', title: 'Stale Issues' },
          { name: 'community-health', title: 'Community Health' },
        ]}
      >
        {(tab: { name: string; title: string }) => (
          <div style={{ marginTop: '1.5rem' }}>
            {tab.name === 'important-bugs' && (
              <ImportantBugsForm
                settings={localSettings.importantBugs}
                onChange={handleImportantBugsChange}
              />
            )}
            {tab.name === 'stale-issues' && (
              <StaleIssuesForm
                settings={localSettings.staleIssues}
                onChange={handleStaleIssuesChange}
              />
            )}
            {tab.name === 'community-health' && (
              <CommunityHealthForm
                settings={localSettings.communityHealth}
                onChange={handleCommunityHealthChange}
              />
            )}
          </div>
        )}
      </TabPanel>

      {/* Action Buttons (outside card, shared for all tabs) */}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
        <Button variant="primary" onClick={handleSave} isBusy={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button variant="secondary" onClick={handleReset} disabled={saving}>
          Reset to Defaults
        </Button>
      </div>
    </Page>
  );
}

export default Settings;
