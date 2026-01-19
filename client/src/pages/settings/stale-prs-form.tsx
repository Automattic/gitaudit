import { useMemo, useCallback } from 'react';
import { DataForm } from '@wordpress/dataviews';
import {
  CheckboxControl,
  __experimentalNumberControl as NumberControl,
} from '@wordpress/components';
import {
  flattenStalePRsSettings,
  unflattenStalePRsSettings,
} from './settings-helpers';
import type { RepoSettings } from '@/data/api/settings/types';

type StalePRsSettings = RepoSettings['stalePRs'];
type FlattenedSettings = Record<string, string | number | boolean | string[]>;

interface FieldEditProps {
  data: FlattenedSettings;
  field: { id: string; label: string; type?: string };
  onChange: (updates: Partial<FlattenedSettings>) => void;
}

interface StalePRsFormProps {
  settings: StalePRsSettings;
  onChange: (settings: StalePRsSettings) => void;
}

function StalePRsForm({ settings, onChange }: StalePRsFormProps) {
  const flatData = useMemo(
    () => flattenStalePRsSettings(settings),
    [settings]
  );

  const handleChange = useCallback(
    (edits: Partial<FlattenedSettings>) => {
      const updated = unflattenStalePRsSettings(edits, settings);
      onChange(updated);
    },
    [settings, onChange]
  );

  // Field definitions
  const fields = useMemo(
    () => [
      // Activity Range 0
      {
        id: 'activityRange_0_days',
        type: 'integer' as const,
        label: 'Days',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
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
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            help="Points awarded for this range"
          />
        ),
      },

      // Activity Range 1
      {
        id: 'activityRange_1_days',
        type: 'integer' as const,
        label: 'Days',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
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
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            help="Points awarded for this range"
          />
        ),
      },

      // Activity Range 2
      {
        id: 'activityRange_2_days',
        type: 'integer' as const,
        label: 'Days',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
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
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            help="Points awarded for this range"
          />
        ),
      },

      // Activity Range 3
      {
        id: 'activityRange_3_days',
        type: 'integer' as const,
        label: 'Days',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
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
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            help="Points awarded for this range"
          />
        ),
      },

      // Bonus Rule: Review Status
      {
        id: 'reviewStatus_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Award points based on review status"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'reviewStatus_noReviewsPoints',
        type: 'integer' as const,
        label: 'No Reviews Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.reviewStatus_enabled}
            help="Points for PRs with no reviews"
          />
        ),
      },
      {
        id: 'reviewStatus_changesRequestedPoints',
        type: 'integer' as const,
        label: 'Changes Requested Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.reviewStatus_enabled}
            help="Points for PRs with changes requested"
          />
        ),
      },
      {
        id: 'reviewStatus_approvedNotMergedPoints',
        type: 'integer' as const,
        label: 'Approved Not Merged Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.reviewStatus_enabled}
            help="Points for approved PRs not yet merged"
          />
        ),
      },

      // Bonus Rule: Draft Penalty
      {
        id: 'draftPenalty_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Reduce priority for draft PRs"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'draftPenalty_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={-200}
            max={0}
            disabled={!data.draftPenalty_enabled}
            help="Negative points for draft PRs"
          />
        ),
      },

      // Bonus Rule: Abandoned by Contributor
      {
        id: 'abandonedByContributor_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="PRs not updated by author for a long time"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'abandonedByContributor_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.abandonedByContributor_enabled}
            help="Bonus points for abandoned PRs"
          />
        ),
      },
      {
        id: 'abandonedByContributor_daysThreshold',
        type: 'integer' as const,
        label: 'Days Threshold',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={1}
            max={365}
            disabled={!data.abandonedByContributor_enabled}
            help="Days without update from author"
          />
        ),
      },

      // Bonus Rule: Merge Conflicts
      {
        id: 'mergeConflicts_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="PRs with merge conflicts"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'mergeConflicts_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.mergeConflicts_enabled}
            help="Bonus points for merge conflicts"
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
            label="PRs with high community interest that went cold"
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
            value={data[field.id] as string | number | undefined}
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
            value={data[field.id] as string | number | undefined}
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
            value={data[field.id] as string | number | undefined}
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
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={1}
            max={365}
            disabled={!data.highInterestButStale_enabled}
            help="Days without activity to qualify"
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
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 125 })}
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
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 100 })}
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
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 70 })}
            min={0}
            max={500}
            help="Minimum score for medium priority"
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
              id: 'review-status',
              label: 'Review Status',
              children: [
                'reviewStatus_enabled',
                {
                  id: 'review-status-fields',
                  layout: { type: 'row' as const, alignment: 'start' as const },
                  children: [
                    'reviewStatus_noReviewsPoints',
                    'reviewStatus_changesRequestedPoints',
                    'reviewStatus_approvedNotMergedPoints',
                  ],
                },
              ],
            },
            {
              id: 'draft-penalty',
              label: 'Draft Penalty',
              children: [
                'draftPenalty_enabled',
                {
                  id: 'draft-penalty-fields',
                  layout: { type: 'row' as const, alignment: 'start' as const },
                  children: ['draftPenalty_points'],
                },
              ],
            },
            {
              id: 'abandoned-by-contributor',
              label: 'Abandoned by Contributor',
              children: [
                'abandonedByContributor_enabled',
                {
                  id: 'abandoned-by-contributor-fields',
                  layout: { type: 'row' as const, alignment: 'start' as const },
                  children: [
                    'abandonedByContributor_points',
                    'abandonedByContributor_daysThreshold',
                  ],
                },
              ],
            },
            {
              id: 'merge-conflicts',
              label: 'Merge Conflicts',
              children: [
                'mergeConflicts_enabled',
                {
                  id: 'merge-conflicts-fields',
                  layout: { type: 'row' as const, alignment: 'start' as const },
                  children: ['mergeConflicts_points'],
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

export default StalePRsForm;
