import { useMemo, useCallback } from 'react';
import { DataForm } from '@wordpress/dataviews';
import {
  CheckboxControl,
  __experimentalNumberControl as NumberControl,
  TextControl,
} from '@wordpress/components';
import {
  flattenImportantBugsSettings,
  unflattenImportantBugsSettings,
} from './settings-helpers';
import type { RepoSettings } from '@/data/api/settings/types';

type ImportantBugsSettings = RepoSettings['bugs'];
type FlattenedSettings = Record<string, string | number | boolean | string[]>;

interface FieldEditProps {
  data: FlattenedSettings;
  field: { id: string; label: string; type: string };
  onChange: (updates: Partial<FlattenedSettings>) => void;
}

interface ImportantBugsFormProps {
  settings: ImportantBugsSettings;
  onChange: (settings: ImportantBugsSettings) => void;
}

function ImportantBugsForm({ settings, onChange }: ImportantBugsFormProps) {
  // Flatten for DataForm
  const flatData = useMemo(
    () => flattenImportantBugsSettings(settings),
    [settings]
  );

  // Handle changes from DataForm
  const handleChange = useCallback(
    (edits: Partial<FlattenedSettings>) => {
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
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Issues with priority labels (critical, urgent, high, p0, etc.)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'priorityLabels_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.priorityLabels_enabled}
            help="Points added to score when labels match"
          />
        ),
      },
      {
        id: 'priorityLabels_labels',
        type: 'text' as const,
        label: 'Labels (comma-separated)',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <TextControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
            disabled={!data.priorityLabels_enabled}
            help="Enter label patterns to match, separated by commas"
          />
        ),
      },

      // Low Priority Labels
      {
        id: 'lowPriorityLabels_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Issues with low priority labels (negative scoring)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'lowPriorityLabels_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={-200}
            max={200}
            disabled={!data.lowPriorityLabels_enabled}
            help="Points subtracted from score (use negative values)"
          />
        ),
      },
      {
        id: 'lowPriorityLabels_labels',
        type: 'text' as const,
        label: 'Labels (comma-separated)',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <TextControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
            disabled={!data.lowPriorityLabels_enabled}
            help="Enter label patterns to match, separated by commas"
          />
        ),
      },

      // Recent Activity
      {
        id: 'recentActivity_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Issues updated within a specific number of days"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'recentActivity_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.recentActivity_enabled}
            help="Points added for recent activity"
          />
        ),
      },
      {
        id: 'recentActivity_daysThreshold',
        type: 'integer' as const,
        label: 'Days Threshold',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 7 })}
            min={1}
            max={365}
            disabled={!data.recentActivity_enabled}
            help="Maximum days since last update to qualify"
          />
        ),
      },

      // High Reactions
      {
        id: 'highReactions_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Issues with more than a certain number of reactions"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'highReactions_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.highReactions_enabled}
            help="Points added when reaction threshold met"
          />
        ),
      },
      {
        id: 'highReactions_reactionThreshold',
        type: 'integer' as const,
        label: 'Reaction Threshold',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 5 })}
            min={1}
            max={100}
            disabled={!data.highReactions_enabled}
            help="Minimum number of reactions required"
          />
        ),
      },

      // Assigned
      {
        id: 'assigned_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Issues that have been assigned to someone"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'assigned_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.assigned_enabled}
            help="Points added when issue is assigned"
          />
        ),
      },

      // Milestone
      {
        id: 'milestone_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Issues that are part of a milestone"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'milestone_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.milestone_enabled}
            help="Points added when issue has a milestone"
          />
        ),
      },

      // Active Discussion
      {
        id: 'activeDiscussion_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Issues with high comment activity (scaled scoring)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'activeDiscussion_baseThreshold',
        type: 'integer' as const,
        label: 'Base Threshold (comments)',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 5 })}
            min={0}
            max={100}
            disabled={!data.activeDiscussion_enabled}
            help="Minimum comments before scoring starts"
          />
        ),
      },
      {
        id: 'activeDiscussion_pointsPer10Comments',
        type: 'integer' as const,
        label: 'Points per 10 comments',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 5 })}
            min={0}
            max={50}
            disabled={!data.activeDiscussion_enabled}
            help="Points added for every 10 comments above threshold"
          />
        ),
      },
      {
        id: 'activeDiscussion_maxPoints',
        type: 'integer' as const,
        label: 'Max Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 50 })}
            min={0}
            max={100}
            disabled={!data.activeDiscussion_enabled}
            help="Maximum points that can be awarded"
          />
        ),
      },

      // Long-standing But Active
      {
        id: 'longstandingButActive_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Old issues that have recent activity"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'longstandingButActive_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.longstandingButActive_enabled}
            help="Points added when both conditions met"
          />
        ),
      },
      {
        id: 'longstandingButActive_ageThreshold',
        type: 'integer' as const,
        label: 'Age Threshold (days)',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 30 })}
            min={1}
            max={365}
            disabled={!data.longstandingButActive_enabled}
            help="Minimum age of issue in days"
          />
        ),
      },
      {
        id: 'longstandingButActive_activityThreshold',
        type: 'integer' as const,
        label: 'Activity Threshold (days)',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 14 })}
            min={1}
            max={365}
            disabled={!data.longstandingButActive_enabled}
            help="Maximum days since last activity"
          />
        ),
      },

      // Sentiment Analysis
      {
        id: 'sentimentAnalysis_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="AI-powered sentiment analysis (negative sentiment = higher score)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'sentimentAnalysis_maxPoints',
        type: 'integer' as const,
        label: 'Max Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 30 })}
            min={0}
            max={50}
            disabled={!data.sentimentAnalysis_enabled}
          />
        ),
      },

      // Thresholds
      {
        id: 'thresholds_critical',
        type: 'integer' as const,
        label: 'Critical (minimum)',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 120 })}
            min={0}
            max={500}
            help="Minimum score for critical priority"
          />
        ),
      },
      {
        id: 'thresholds_high',
        type: 'integer' as const,
        label: 'High (minimum)',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 80 })}
            min={0}
            max={500}
            help="Minimum score for high priority"
          />
        ),
      },
      {
        id: 'thresholds_medium',
        type: 'integer' as const,
        label: 'Medium (minimum)',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 50 })}
            min={0}
            max={500}
            help="Minimum score for medium priority"
          />
        ),
      },
    ],
    []
  );

  // Form layout
  const form = useMemo(
    () => ({
      layout: { type: 'card' as const },
      fields: [
        {
          id: 'thresholds',
          label: 'Score Thresholds',
          description:
            'Define the minimum scores required for each priority level.',
          layout: { type: 'card' as const },
          children: [
            {
              id: 'thresholds-fields',
              layout: { type: 'row' as const, alignment: 'start' as const },
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
                  layout: { type: 'row' as const, alignment: 'start' as const },
                  children: ['priorityLabels_points', 'priorityLabels_labels'],
                },
              ],
            },
            {
              id: 'low-priority-labels',
              label: 'Low Priority Labels',
              children: [
                'lowPriorityLabels_enabled',
                {
                  id: 'low-priority-labels-fields',
                  layout: { type: 'row' as const, alignment: 'start' as const },
                  children: ['lowPriorityLabels_points', 'lowPriorityLabels_labels'],
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
                  layout: { type: 'row' as const, alignment: 'start' as const },
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
                  layout: { type: 'row' as const, alignment: 'start' as const },
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
                  layout: { type: 'row' as const, alignment: 'start' as const },
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
                  layout: { type: 'row' as const, alignment: 'start' as const },
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
                  layout: { type: 'row' as const, alignment: 'start' as const },
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
                  layout: { type: 'row' as const, alignment: 'start' as const },
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
                  layout: { type: 'row' as const, alignment: 'start' as const },
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
