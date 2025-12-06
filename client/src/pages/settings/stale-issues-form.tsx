import { useMemo, useCallback } from 'react';
import { DataForm } from '@wordpress/dataviews';
import {
  CheckboxControl,
  __experimentalNumberControl as NumberControl,
} from '@wordpress/components';
import {
  flattenStaleIssuesSettings,
  unflattenStaleIssuesSettings,
} from './settings-helpers';
import type { RepoSettings } from '@/data/api/settings/types';

type StaleIssuesSettings = RepoSettings['stale'];
type FlattenedSettings = Record<string, string | number | boolean | string[]>;

interface FieldEditProps {
  data: FlattenedSettings;
  field: { id: string; label: string; type: string };
  onChange: (updates: Partial<FlattenedSettings>) => void;
}

interface StaleIssuesFormProps {
  settings: StaleIssuesSettings;
  onChange: (settings: StaleIssuesSettings) => void;
}

function StaleIssuesForm({ settings, onChange }: StaleIssuesFormProps) {
  const flatData = useMemo(
    () => flattenStaleIssuesSettings(settings),
    [settings]
  );

  const handleChange = useCallback(
    (edits: Partial<FlattenedSettings>) => {
      const updated = unflattenStaleIssuesSettings(edits, settings);
      onChange(updated);
    },
    [settings, onChange]
  );

  // Field definitions (35 fields total)
  const fields = useMemo(
    () => [
      // Activity Range 0 (365 days, 50 points)
      {
        id: 'activityRange_0_days',
        type: 'integer' as const,
        label: 'Days',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={1}
            max={999}
            help="Days without activity to match this range"
          />
        ),
      },
      {
        id: 'activityRange_0_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            help="Points awarded for this range"
          />
        ),
      },

      // Activity Range 1 (180 days, 40 points)
      {
        id: 'activityRange_1_days',
        type: 'integer' as const,
        label: 'Days',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={1}
            max={999}
            help="Days without activity to match this range"
          />
        ),
      },
      {
        id: 'activityRange_1_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            help="Points awarded for this range"
          />
        ),
      },

      // Activity Range 2 (90 days, 30 points)
      {
        id: 'activityRange_2_days',
        type: 'integer' as const,
        label: 'Days',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={1}
            max={999}
            help="Days without activity to match this range"
          />
        ),
      },
      {
        id: 'activityRange_2_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            help="Points awarded for this range"
          />
        ),
      },

      // Activity Range 3 (60 days, 20 points)
      {
        id: 'activityRange_3_days',
        type: 'integer' as const,
        label: 'Days',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={1}
            max={999}
            help="Days without activity to match this range"
          />
        ),
      },
      {
        id: 'activityRange_3_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            help="Points awarded for this range"
          />
        ),
      },

      // Bonus Rule: Waiting for Response
      {
        id: 'waitingForResponse_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Issues with 'waiting for response' or 'needs more info' labels"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'waitingForResponse_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.waitingForResponse_enabled}
            help="Bonus points for waiting labels"
          />
        ),
      },

      // Bonus Rule: Abandoned by Assignee
      {
        id: 'abandonedByAssignee_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Issues assigned but not updated for a long time"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'abandonedByAssignee_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.abandonedByAssignee_enabled}
            help="Bonus points for abandoned assignments"
          />
        ),
      },
      {
        id: 'abandonedByAssignee_daysThreshold',
        type: 'integer' as const,
        label: 'Days Threshold',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={1}
            max={365}
            disabled={!data.abandonedByAssignee_enabled}
            help="Days without update while assigned"
          />
        ),
      },

      // Bonus Rule: Never Addressed
      {
        id: 'neverAddressed_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Old issues that have never been commented on"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'neverAddressed_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.neverAddressed_enabled}
            help="Bonus points for never addressed issues"
          />
        ),
      },
      {
        id: 'neverAddressed_ageThreshold',
        type: 'integer' as const,
        label: 'Age Threshold (days)',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={1}
            max={999}
            disabled={!data.neverAddressed_enabled}
            help="Minimum age with zero comments"
          />
        ),
      },

      // Bonus Rule: High Interest but Stale
      {
        id: 'highInterestButStale_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Issues with high community interest that went cold"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'highInterestButStale_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.highInterestButStale_enabled}
            help="Bonus points when all thresholds met"
          />
        ),
      },
      {
        id: 'highInterestButStale_reactionThreshold',
        type: 'integer' as const,
        label: 'Reaction Threshold',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={100}
            disabled={!data.highInterestButStale_enabled}
            help="Minimum reactions to qualify"
          />
        ),
      },
      {
        id: 'highInterestButStale_commentsThreshold',
        type: 'integer' as const,
        label: 'Comments Threshold',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={100}
            disabled={!data.highInterestButStale_enabled}
            help="Minimum comments to qualify"
          />
        ),
      },
      {
        id: 'highInterestButStale_daysThreshold',
        type: 'integer' as const,
        label: 'Days Threshold',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={1}
            max={365}
            disabled={!data.highInterestButStale_enabled}
            help="Days without activity to qualify"
          />
        ),
      },

      // Bonus Rule: Stale Milestone (DISABLED by default)
      {
        id: 'staleMilestone_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Issues in a milestone but not updated recently (disabled by default)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'staleMilestone_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.staleMilestone_enabled}
            help="Bonus points for stale milestones"
          />
        ),
      },
      {
        id: 'staleMilestone_daysThreshold',
        type: 'integer' as const,
        label: 'Days Threshold',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={1}
            max={365}
            disabled={!data.staleMilestone_enabled}
            help="Days without activity in milestone"
          />
        ),
      },

      // Bonus Rule: Marked for Closure (DISABLED by default)
      {
        id: 'markedForClosure_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Issues with duplicate/wontfix/invalid labels still open (disabled by default)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'markedForClosure_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.markedForClosure_enabled}
            help="Bonus points for closure labels"
          />
        ),
      },

      // Thresholds
      {
        id: 'thresholds_critical',
        type: 'integer' as const,
        label: 'Critical',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={500}
            help="Minimum score for critical classification"
          />
        ),
      },
      {
        id: 'thresholds_high',
        type: 'integer' as const,
        label: 'High',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={500}
            help="Minimum score for high classification"
          />
        ),
      },
      {
        id: 'thresholds_medium',
        type: 'integer' as const,
        label: 'Medium',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={500}
            help="Minimum score for medium classification"
          />
        ),
      },
    ],
    [flatData]
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
            'Minimum scores for classification. Must be: Very Stale > Moderately Stale > Slightly Stale',
          layout: { type: 'card' as const },
          children: [
            {
              id: 'thresholds-fields',
              layout: { type: 'row' as const, alignment: 'start' as const },
              children: [
                'thresholds_veryStale',
                'thresholds_moderatelyStale',
                'thresholds_slightlyStale',
              ],
            },
          ],
        },
        {
          id: 'activity-time-ranges',
          label: 'Activity Time Ranges',
          description:
            'Configure points awarded based on days without activity. Ranges are checked from longest to shortest.',
          children: [
            {
              id: 'range-0',
              label: '1st Range (Longest)',
              layout: { type: 'row' as const, alignment: 'start' as const },
              children: ['activityRange_0_days', 'activityRange_0_points'],
            },
            {
              id: 'range-1',
              label: '2nd Range',
              layout: { type: 'row' as const, alignment: 'start' as const },
              children: ['activityRange_1_days', 'activityRange_1_points'],
            },
            {
              id: 'range-2',
              label: '3rd Range',
              layout: { type: 'row' as const, alignment: 'start' as const },
              children: ['activityRange_2_days', 'activityRange_2_points'],
            },
            {
              id: 'range-3',
              label: '4th Range (Shortest)',
              layout: { type: 'row' as const, alignment: 'start' as const },
              children: ['activityRange_3_days', 'activityRange_3_points'],
            },
          ],
        },
        {
          id: 'bonus-rules',
          label: 'Bonus Scoring Rules',
          description: 'Additional points for specific conditions',
          children: [
            {
              id: 'waiting-for-response',
              label: 'Waiting for Response',
              children: [
                'waitingForResponse_enabled',
                {
                  id: 'waiting-for-response-fields',
                  layout: { type: 'row' as const, alignment: 'start' as const },
                  children: ['waitingForResponse_points'],
                },
              ],
            },
            {
              id: 'abandoned-by-assignee',
              label: 'Abandoned by Assignee',
              children: [
                'abandonedByAssignee_enabled',
                {
                  id: 'abandoned-by-assignee-fields',
                  layout: { type: 'row' as const, alignment: 'start' as const },
                  children: [
                    'abandonedByAssignee_points',
                    'abandonedByAssignee_daysThreshold',
                  ],
                },
              ],
            },
            {
              id: 'never-addressed',
              label: 'Never Addressed',
              children: [
                'neverAddressed_enabled',
                {
                  id: 'never-addressed-fields',
                  layout: { type: 'row' as const, alignment: 'start' as const },
                  children: [
                    'neverAddressed_points',
                    'neverAddressed_ageThreshold',
                  ],
                },
              ],
            },
            {
              id: 'high-interest-but-stale',
              label: 'High Interest but Stale',
              children: [
                'highInterestButStale_enabled',
                {
                  id: 'high-interest-but-stale-fields',
                  layout: { type: 'row' as const, alignment: 'start' as const },
                  children: [
                    'highInterestButStale_points',
                    'highInterestButStale_reactionThreshold',
                    'highInterestButStale_commentsThreshold',
                    'highInterestButStale_daysThreshold',
                  ],
                },
              ],
            },
            {
              id: 'stale-milestone',
              label: 'Stale Milestone (Disabled by Default)',
              children: [
                'staleMilestone_enabled',
                {
                  id: 'stale-milestone-fields',
                  layout: { type: 'row' as const, alignment: 'start' as const },
                  children: [
                    'staleMilestone_points',
                    'staleMilestone_daysThreshold',
                  ],
                },
              ],
            },
            {
              id: 'marked-for-closure',
              label: 'Marked for Closure (Disabled by Default)',
              children: [
                'markedForClosure_enabled',
                {
                  id: 'marked-for-closure-fields',
                  layout: { type: 'row' as const, alignment: 'start' as const },
                  children: ['markedForClosure_points'],
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

export default StaleIssuesForm;
