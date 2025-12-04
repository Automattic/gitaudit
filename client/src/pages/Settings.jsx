import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { TabPanel, Button, Notice, Spinner } from '@wordpress/components';
import ImportantBugsForm from './settings/ImportantBugsForm';
import StaleIssuesForm from './settings/StaleIssuesForm';
import CommunityHealthForm from './settings/CommunityHealthForm';
import api from '../utils/api';
import Page from '../components/Page';

function Settings() {
  const { owner, repo } = useParams();

  // State
  const [settings, setSettings] = useState(null); // Full unified settings
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [owner, repo]);

  async function loadSettings() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get(`/api/repos/${owner}/${repo}/issues/settings`);
      setSettings(data); // { importantBugs: {...}, staleIssues: {...} }
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      await api.put(`/api/repos/${owner}/${repo}/issues/settings`, settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(
        err.response?.data?.details?.join(', ') ||
          err.message ||
          'Failed to save settings'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm('Reset all settings to defaults? This cannot be undone.'))
      return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      const defaults = await api.delete(`/api/repos/${owner}/${repo}/issues/settings`);
      setSettings(defaults);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to reset settings:', err);
      setError(err.message || 'Failed to reset settings');
    } finally {
      setSaving(false);
    }
  }

  // Callbacks for child components
  function handleImportantBugsChange(updatedImportantBugs) {
    setSettings((prev) => ({
      ...prev,
      importantBugs: updatedImportantBugs,
    }));
  }

  function handleStaleIssuesChange(updatedStaleIssues) {
    setSettings((prev) => ({
      ...prev,
      staleIssues: updatedStaleIssues,
    }));
  }

  function handleCommunityHealthChange(updatedCommunityHealth) {
    setSettings((prev) => ({
      ...prev,
      communityHealth: updatedCommunityHealth,
    }));
  }

  if (loading) {
    return (
      <Page title="Scoring Settings">
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Spinner />
          <p style={{ marginTop: '1rem', color: '#666' }}>Loading settings...</p>
        </div>
      </Page>
    );
  }

  if (!settings) {
    return (
      <Page title="Scoring Settings">
        <Notice status="error" isDismissible={false}>
          Failed to load settings. Please try again.
        </Notice>
      </Page>
    );
  }

  return (
    <Page
      title="Scoring Settings"
      description="Configure how issues are scored and prioritized"
    >
      {/* Success/Error Notices */}
      {success && (
        <Notice
          status="success"
          isDismissible
          onRemove={() => setSuccess(false)}
          style={{ marginBottom: '1rem' }}
        >
          Settings saved successfully!
        </Notice>
      )}
      {error && (
        <Notice
          status="error"
          isDismissible
          onRemove={() => setError(null)}
          style={{ marginBottom: '1rem' }}
        >
          {error}
        </Notice>
      )}

      <TabPanel
        className="settings-tabs"
        activeClass="is-active"
        tabs={[
          { name: 'important-bugs', title: 'Important Bugs' },
          { name: 'stale-issues', title: 'Stale Issues' },
          { name: 'community-health', title: 'Community Health' },
        ]}
      >
        {(tab) => (
          <>
            {tab.name === 'important-bugs' && (
              <ImportantBugsForm
                settings={settings.importantBugs}
                onChange={handleImportantBugsChange}
              />
            )}
            {tab.name === 'stale-issues' && (
              <StaleIssuesForm
                settings={settings.staleIssues}
                onChange={handleStaleIssuesChange}
              />
            )}
            {tab.name === 'community-health' && (
              <CommunityHealthForm
                settings={settings.communityHealth}
                onChange={handleCommunityHealthChange}
              />
            )}
          </>
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
