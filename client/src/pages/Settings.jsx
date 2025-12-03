import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DataForm } from '@wordpress/dataviews';
import {
  Card,
  CardBody,
  Button,
  Spinner,
  Notice,
  __experimentalNumberControl as NumberControl,
  CheckboxControl,
} from '@wordpress/components';
import api from '../utils/api';
import Page from '../components/Page';

function Settings() {
  const { owner, repo } = useParams();
  const navigate = useNavigate();

  const [settings, setSettings] = useState(null);
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
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  // Flatten nested settings for DataForm
  const flatData = useMemo(() => {
    if (!settings) return null;
    const rules = settings.scoringRules;
    return {
      // Priority Labels
      priorityLabels_enabled: rules.priorityLabels.enabled,
      priorityLabels_points: rules.priorityLabels.points,

      // Recent Activity
      recentActivity_enabled: rules.recentActivity.enabled,
      recentActivity_points: rules.recentActivity.points,
      recentActivity_daysThreshold: rules.recentActivity.daysThreshold,

      // High Reactions
      highReactions_enabled: rules.highReactions.enabled,
      highReactions_points: rules.highReactions.points,
      highReactions_reactionThreshold: rules.highReactions.reactionThreshold,

      // Assigned
      assigned_enabled: rules.assigned.enabled,
      assigned_points: rules.assigned.points,

      // Milestone
      milestone_enabled: rules.milestone.enabled,
      milestone_points: rules.milestone.points,

      // Active Discussion
      activeDiscussion_enabled: rules.activeDiscussion.enabled,
      activeDiscussion_baseThreshold: rules.activeDiscussion.baseThreshold,
      activeDiscussion_pointsPer10Comments: rules.activeDiscussion.pointsPer10Comments,
      activeDiscussion_maxPoints: rules.activeDiscussion.maxPoints,

      // Long-standing But Active
      longstandingButActive_enabled: rules.longstandingButActive.enabled,
      longstandingButActive_points: rules.longstandingButActive.points,
      longstandingButActive_ageThreshold: rules.longstandingButActive.ageThreshold,
      longstandingButActive_activityThreshold: rules.longstandingButActive.activityThreshold,

      // Sentiment Analysis
      sentimentAnalysis_enabled: rules.sentimentAnalysis.enabled,
      sentimentAnalysis_maxPoints: rules.sentimentAnalysis.maxPoints,

      // Thresholds
      thresholds_critical: settings.thresholds.critical,
      thresholds_high: settings.thresholds.high,
      thresholds_medium: settings.thresholds.medium,
    };
  }, [settings]);

  // Define fields for DataForm
  const fields = useMemo(() => [
    // Priority Labels
    {
      id: 'priorityLabels_enabled',
      type: 'text',
      label: 'Enable',
      Edit: ({ data, field, onChange }) => (
        <CheckboxControl
          label="Issues with priority labels (critical, urgent, p0, etc.)"
          checked={data[field.id]}
          onChange={(value) => onChange({ [field.id]: value })}
        />
      ),
    },
    {
      id: 'priorityLabels_points',
      type: 'integer',
      label: 'Points',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 0 })}
          min={0}
          max={200}
          disabled={!data.priorityLabels_enabled}
        />
      ),
    },

    // Recent Activity
    {
      id: 'recentActivity_enabled',
      type: 'text',
      label: 'Enable',
      Edit: ({ data, field, onChange }) => (
        <CheckboxControl
          label="Issues updated within a specific number of days"
          checked={data[field.id]}
          onChange={(value) => onChange({ [field.id]: value })}
        />
      ),
    },
    {
      id: 'recentActivity_points',
      type: 'integer',
      label: 'Points',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 0 })}
          min={0}
          max={200}
          disabled={!data.recentActivity_enabled}
        />
      ),
    },
    {
      id: 'recentActivity_daysThreshold',
      type: 'integer',
      label: 'Days Threshold',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 7 })}
          min={1}
          max={365}
          disabled={!data.recentActivity_enabled}
        />
      ),
    },

    // High Reactions
    {
      id: 'highReactions_enabled',
      type: 'text',
      label: 'Enable',
      Edit: ({ data, field, onChange }) => (
        <CheckboxControl
          label="Issues with more than a certain number of reactions"
          checked={data[field.id]}
          onChange={(value) => onChange({ [field.id]: value })}
        />
      ),
    },
    {
      id: 'highReactions_points',
      type: 'integer',
      label: 'Points',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 0 })}
          min={0}
          max={200}
          disabled={!data.highReactions_enabled}
        />
      ),
    },
    {
      id: 'highReactions_reactionThreshold',
      type: 'integer',
      label: 'Reaction Threshold',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 5 })}
          min={1}
          max={100}
          disabled={!data.highReactions_enabled}
        />
      ),
    },

    // Assigned
    {
      id: 'assigned_enabled',
      type: 'text',
      label: 'Enable',
      Edit: ({ data, field, onChange }) => (
        <CheckboxControl
          label="Issues that have been assigned to someone"
          checked={data[field.id]}
          onChange={(value) => onChange({ [field.id]: value })}
        />
      ),
    },
    {
      id: 'assigned_points',
      type: 'integer',
      label: 'Points',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 0 })}
          min={0}
          max={200}
          disabled={!data.assigned_enabled}
        />
      ),
    },

    // Milestone
    {
      id: 'milestone_enabled',
      type: 'text',
      label: 'Enable',
      Edit: ({ data, field, onChange }) => (
        <CheckboxControl
          label="Issues that are part of a milestone"
          checked={data[field.id]}
          onChange={(value) => onChange({ [field.id]: value })}
        />
      ),
    },
    {
      id: 'milestone_points',
      type: 'integer',
      label: 'Points',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 0 })}
          min={0}
          max={200}
          disabled={!data.milestone_enabled}
        />
      ),
    },

    // Active Discussion
    {
      id: 'activeDiscussion_enabled',
      type: 'text',
      label: 'Enable',
      Edit: ({ data, field, onChange }) => (
        <CheckboxControl
          label="Issues with high comment activity (scaled scoring)"
          checked={data[field.id]}
          onChange={(value) => onChange({ [field.id]: value })}
        />
      ),
    },
    {
      id: 'activeDiscussion_baseThreshold',
      type: 'integer',
      label: 'Base Threshold (comments)',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 5 })}
          min={0}
          max={100}
          disabled={!data.activeDiscussion_enabled}
        />
      ),
    },
    {
      id: 'activeDiscussion_pointsPer10Comments',
      type: 'integer',
      label: 'Points per 10 comments',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 5 })}
          min={0}
          max={50}
          disabled={!data.activeDiscussion_enabled}
        />
      ),
    },
    {
      id: 'activeDiscussion_maxPoints',
      type: 'integer',
      label: 'Max Points',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 50 })}
          min={0}
          max={100}
          disabled={!data.activeDiscussion_enabled}
        />
      ),
    },

    // Long-standing But Active
    {
      id: 'longstandingButActive_enabled',
      type: 'text',
      label: 'Enable',
      Edit: ({ data, field, onChange }) => (
        <CheckboxControl
          label="Old issues that have recent activity"
          checked={data[field.id]}
          onChange={(value) => onChange({ [field.id]: value })}
        />
      ),
    },
    {
      id: 'longstandingButActive_points',
      type: 'integer',
      label: 'Points',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 0 })}
          min={0}
          max={200}
          disabled={!data.longstandingButActive_enabled}
        />
      ),
    },
    {
      id: 'longstandingButActive_ageThreshold',
      type: 'integer',
      label: 'Age Threshold (days)',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 30 })}
          min={1}
          max={365}
          disabled={!data.longstandingButActive_enabled}
        />
      ),
    },
    {
      id: 'longstandingButActive_activityThreshold',
      type: 'integer',
      label: 'Activity Threshold (days)',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 14 })}
          min={1}
          max={365}
          disabled={!data.longstandingButActive_enabled}
        />
      ),
    },

    // Sentiment Analysis
    {
      id: 'sentimentAnalysis_enabled',
      type: 'text',
      label: 'Enable',
      Edit: ({ data, field, onChange }) => (
        <CheckboxControl
          label="AI-powered sentiment analysis (negative sentiment = higher score)"
          checked={data[field.id]}
          onChange={(value) => onChange({ [field.id]: value })}
        />
      ),
    },
    {
      id: 'sentimentAnalysis_maxPoints',
      type: 'integer',
      label: 'Max Points',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 30 })}
          min={0}
          max={50}
          disabled={!data.sentimentAnalysis_enabled}
        />
      ),
    },

    // Thresholds
    {
      id: 'thresholds_critical',
      type: 'integer',
      label: 'Critical (minimum)',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 120 })}
          min={0}
          max={500}
        />
      ),
    },
    {
      id: 'thresholds_high',
      type: 'integer',
      label: 'High (minimum)',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 80 })}
          min={0}
          max={500}
        />
      ),
    },
    {
      id: 'thresholds_medium',
      type: 'integer',
      label: 'Medium (minimum)',
      Edit: ({ data, field, onChange }) => (
        <NumberControl
          value={data[field.id]}
          onChange={(value) => onChange({ [field.id]: parseInt(value) || 50 })}
          min={0}
          max={500}
        />
      ),
    },
  ], []);

  // Define form layout with card style
  const form = useMemo(() => ({
      layout: { type: "card" },
    fields: [
      {
        id: 'thresholds',
        label: 'Priority Thresholds',
        description: 'Define the minimum scores required for each priority level.',
        children: ['thresholds_critical', 'thresholds_high', 'thresholds_medium'],
      },
      {
        id: 'scoring-rules',
        label: 'Scoring Rules',
        description: 'Enable and configure individual scoring rules for bug prioritization.',
        children: [
          {
            id: 'priority-labels',
            label: 'Priority Labels',
            children: ['priorityLabels_enabled', 'priorityLabels_points'],
          },
          {
            id: 'recent-activity',
            label: 'Recent Activity',
            children: ['recentActivity_enabled', 'recentActivity_points', 'recentActivity_daysThreshold'],
          },
          {
            id: 'high-reactions',
            label: 'High Reactions',
            children: ['highReactions_enabled', 'highReactions_points', 'highReactions_reactionThreshold'],
          },
          {
            id: 'assigned',
            label: 'Assigned',
            children: ['assigned_enabled', 'assigned_points'],
          },
          {
            id: 'milestone',
            label: 'Milestone',
            children: ['milestone_enabled', 'milestone_points'],
          },
          {
            id: 'active-discussion',
            label: 'Active Discussion',
            children: [
              'activeDiscussion_enabled',
              'activeDiscussion_baseThreshold',
              'activeDiscussion_pointsPer10Comments',
              'activeDiscussion_maxPoints',
            ],
          },
          {
            id: 'longstanding-but-active',
            label: 'Long-standing But Active',
            children: [
              'longstandingButActive_enabled',
              'longstandingButActive_points',
              'longstandingButActive_ageThreshold',
              'longstandingButActive_activityThreshold',
            ],
          },
          {
            id: 'sentiment-analysis',
            label: 'Sentiment Analysis',
            children: ['sentimentAnalysis_enabled', 'sentimentAnalysis_maxPoints'],
          },
        ],
      },
    ],
  }), []);

  // Handle changes from DataForm
  const handleChange = useCallback((edits) => {
    setSettings(prev => {
      // Deep clone to avoid mutation
      const updated = JSON.parse(JSON.stringify(prev));

      Object.entries(edits).forEach(([key, value]) => {
        if (key.startsWith('thresholds_')) {
          const thresholdKey = key.replace('thresholds_', '');
          updated.thresholds[thresholdKey] = value;
        } else {
          // Parse rule name and property
          const parts = key.split('_');
          const ruleName = parts[0];
          const propName = parts.slice(1).join('_');

          if (!updated.scoringRules[ruleName]) {
            updated.scoringRules[ruleName] = {};
          }
          updated.scoringRules[ruleName][propName] = value;
        }
      });

      return updated;
    });
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      await api.put(`/api/repos/${owner}/${repo}/issues/settings`, settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err.response?.data?.details?.join(', ') || err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm('Reset all settings to defaults? This cannot be undone.')) return;

    try {
      setSaving(true);
      setError(null);
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

  if (loading) {
    return (
      <Page title="Scoring Settings">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner />
          <p style={{ marginTop: '1rem', color: '#666' }}>Loading settings...</p>
        </div>
      </Page>
    );
  }

  if (!settings || !flatData) {
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
      description="Customize how bug priority scores are calculated for this repository."
    >
      {error && (
        <Notice status="error" isDismissible={false} style={{ marginBottom: '1rem' }}>
          {error}
        </Notice>
      )}

      {success && (
        <Notice status="success" isDismissible={false} style={{ marginBottom: '1rem' }}>
          Settings saved successfully!
        </Notice>
      )}

      <DataForm
        data={flatData}
        fields={fields}
        form={form}
        onChange={handleChange}
      />

      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
        <Button
          variant="tertiary"
          onClick={() => navigate(`/repos/${owner}/${repo}/bugs`)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          variant="secondary"
          onClick={handleReset}
          disabled={saving}
        >
          Reset to Defaults
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </Page>
  );
}

export default Settings;
