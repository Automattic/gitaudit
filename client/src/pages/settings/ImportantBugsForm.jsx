import React, { useMemo, useCallback } from 'react';
import { DataForm } from '@wordpress/dataviews';
import {
  CheckboxControl,
  __experimentalNumberControl as NumberControl,
} from '@wordpress/components';
import {
  flattenImportantBugsSettings,
  unflattenImportantBugsSettings,
} from './settingsHelpers';

function ImportantBugsForm({ settings, onChange }) {
  // Flatten for DataForm
  const flatData = useMemo(
    () => flattenImportantBugsSettings(settings),
    [settings]
  );

  // Handle changes from DataForm
  const handleChange = useCallback(
    (edits) => {
      const updated = unflattenImportantBugsSettings(edits, settings);
      onChange(updated);
    },
    [settings, onChange]
  );

  // Field definitions
  const fields = useMemo(
    () => [
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
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
            label={field.label}
            value={data[field.id]}
            onChange={(value) => onChange({ [field.id]: parseInt(value) || 50 })}
            min={0}
            max={500}
          />
        ),
      },
    ],
    []
  );

  // Form layout
  const form = useMemo(
    () => ({
      layout: { type: 'card' },
      fields: [
        {
          id: 'thresholds',
          label: 'Priority Thresholds',
          description:
            'Define the minimum scores required for each priority level.',
          layout: { type: 'card' },
          children: [
            {
              id: 'thresholds-fields',
              layout: { type: 'row' },
              children: [
                'thresholds_critical',
                'thresholds_high',
                'thresholds_medium',
              ],
            },
          ],
        },
        {
          id: 'scoring-rules',
          label: 'Scoring Rules',
          description:
            'Enable and configure individual scoring rules for bug prioritization.',
          children: [
            {
              id: 'priority-labels',
              label: 'Priority Labels',
              children: [
                'priorityLabels_enabled',
                {
                  id: 'priority-labels-fields',
                  layout: { type: 'row' },
                  children: ['priorityLabels_points'],
                },
              ],
            },
            {
              id: 'recent-activity',
              label: 'Recent Activity',
              children: [
                'recentActivity_enabled',
                {
                  id: 'recent-activity-fields',
                  layout: { type: 'row' },
                  children: [
                    'recentActivity_points',
                    'recentActivity_daysThreshold',
                  ],
                },
              ],
            },
            {
              id: 'high-reactions',
              label: 'High Reactions',
              children: [
                'highReactions_enabled',
                {
                  id: 'high-reactions-fields',
                  layout: { type: 'row' },
                  children: [
                    'highReactions_points',
                    'highReactions_reactionThreshold',
                  ],
                },
              ],
            },
            {
              id: 'assigned',
              label: 'Assigned',
              children: [
                'assigned_enabled',
                {
                  id: 'assigned-fields',
                  layout: { type: 'row' },
                  children: ['assigned_points'],
                },
              ],
            },
            {
              id: 'milestone',
              label: 'Milestone',
              children: [
                'milestone_enabled',
                {
                  id: 'milestone-fields',
                  layout: { type: 'row' },
                  children: ['milestone_points'],
                },
              ],
            },
            {
              id: 'active-discussion',
              label: 'Active Discussion',
              children: [
                'activeDiscussion_enabled',
                {
                  id: 'active-discussion-fields',
                  layout: { type: 'row' },
                  children: [
                    'activeDiscussion_baseThreshold',
                    'activeDiscussion_pointsPer10Comments',
                    'activeDiscussion_maxPoints',
                  ],
                },
              ],
            },
            {
              id: 'longstanding-but-active',
              label: 'Long-standing But Active',
              children: [
                'longstandingButActive_enabled',
                {
                  id: 'longstanding-but-active-fields',
                  layout: { type: 'row' },
                  children: [
                    'longstandingButActive_points',
                    'longstandingButActive_ageThreshold',
                    'longstandingButActive_activityThreshold',
                  ],
                },
              ],
            },
            {
              id: 'sentiment-analysis',
              label: 'Sentiment Analysis',
              children: [
                'sentimentAnalysis_enabled',
                {
                  id: 'sentiment-analysis-fields',
                  layout: { type: 'row' },
                  children: ['sentimentAnalysis_maxPoints'],
                },
              ],
            },
          ],
        },
      ],
    }),
    []
  );

  return (
    <DataForm
      data={flatData}
      fields={fields}
      form={form}
      onChange={handleChange}
    />
  );
}

export default ImportantBugsForm;
