import { useMemo, useCallback } from 'react';
import { DataForm } from '@wordpress/dataviews';
import {
  CheckboxControl,
  __experimentalNumberControl as NumberControl,
} from '@wordpress/components';
import {
  flattenFeatureRequestSettings,
  unflattenFeatureRequestSettings,
} from './settings-helpers';
import type { RepoSettings } from '@/data/api/settings/types';

type FeatureRequestSettings = RepoSettings['features'];
type FlattenedSettings = Record<string, string | number | boolean | string[]>;

interface FieldEditProps {
  data: FlattenedSettings;
  field: { id: string; label: string; type?: string };
  onChange: (updates: Partial<FlattenedSettings>) => void;
}

interface FeatureRequestFormProps {
  settings: FeatureRequestSettings;
  onChange: (settings: FeatureRequestSettings) => void;
}

function FeatureRequestForm({ settings, onChange }: FeatureRequestFormProps) {
  // Flatten for DataForm
  const flatData = useMemo(
    () => flattenFeatureRequestSettings(settings),
    [settings]
  );

  // Handle changes from DataForm
  const handleChange = useCallback(
    (edits: Partial<FlattenedSettings>) => {
      const updated = unflattenFeatureRequestSettings(edits, settings);
      onChange(updated);
    },
    [settings, onChange]
  );

  // Field definitions
  const fields = useMemo(
    () => [
      // Reactions
      {
        id: 'reactions_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="User reactions (0-20 points based on reaction count)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },

      // Unique Commenters
      {
        id: 'uniqueCommenters_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Unique commenters (0-15 points based on different contributors)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },

      // Me Too Comments
      {
        id: 'meTooComments_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label='"Me too" comments (users explicitly requesting the feature)'
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'meTooComments_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={50}
            disabled={!data.meTooComments_enabled}
            help="Points awarded when threshold met"
          />
        ),
      },
      {
        id: 'meTooComments_minimumCount',
        type: 'integer' as const,
        label: 'Minimum Count',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 3 })}
            min={1}
            max={20}
            disabled={!data.meTooComments_enabled}
            help="Minimum 'me too' comments required"
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
            label="Active discussion (0-15 points based on comment count)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
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
            label="Recent activity (tiered scoring based on days since update)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'recentActivity_recentThreshold',
        type: 'integer' as const,
        label: 'Recent Threshold (days)',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 30 })}
            min={1}
            max={365}
            disabled={!data.recentActivity_enabled}
            help="Maximum days for 'recent' classification"
          />
        ),
      },
      {
        id: 'recentActivity_recentPoints',
        type: 'integer' as const,
        label: 'Recent Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 10 })}
            min={0}
            max={50}
            disabled={!data.recentActivity_enabled}
            help="Points for recent activity"
          />
        ),
      },
      {
        id: 'recentActivity_moderateThreshold',
        type: 'integer' as const,
        label: 'Moderate Threshold (days)',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 90 })}
            min={1}
            max={365}
            disabled={!data.recentActivity_enabled}
            help="Maximum days for 'moderate' classification"
          />
        ),
      },
      {
        id: 'recentActivity_moderatePoints',
        type: 'integer' as const,
        label: 'Moderate Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 5 })}
            min={0}
            max={50}
            disabled={!data.recentActivity_enabled}
            help="Points for moderate activity"
          />
        ),
      },

      // Has Milestone
      {
        id: 'hasMilestone_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Has milestone (indicates planning/commitment)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'hasMilestone_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={50}
            disabled={!data.hasMilestone_enabled}
            help="Points when feature has a milestone"
          />
        ),
      },

      // Has Assignee
      {
        id: 'hasAssignee_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Has assignee (work is allocated)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'hasAssignee_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={50}
            disabled={!data.hasAssignee_enabled}
            help="Points when feature has an assignee"
          />
        ),
      },

      // Author Type
      {
        id: 'authorType_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Author type (team members, contributors, first-timers)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'authorType_teamPoints',
        type: 'integer' as const,
        label: 'Team Member Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 5 })}
            min={0}
            max={20}
            disabled={!data.authorType_enabled}
            help="Points for team member authors"
          />
        ),
      },
      {
        id: 'authorType_contributorPoints',
        type: 'integer' as const,
        label: 'Contributor Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 3 })}
            min={0}
            max={20}
            disabled={!data.authorType_enabled}
            help="Points for regular contributor authors"
          />
        ),
      },
      {
        id: 'authorType_firstTimePoints',
        type: 'integer' as const,
        label: 'First-Time Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 2 })}
            min={0}
            max={20}
            disabled={!data.authorType_enabled}
            help="Points for first-time contributor authors"
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
            label="AI sentiment intensity (measures passion/urgency regardless of polarity)"
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
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 10 })}
            min={0}
            max={20}
            disabled={!data.sentimentAnalysis_enabled}
            help="Maximum points for sentiment intensity"
          />
        ),
      },

      // Stale Penalty
      {
        id: 'stalePenalty_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Stale feature penalty (old and inactive)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'stalePenalty_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || -10 })}
            min={-50}
            max={0}
            disabled={!data.stalePenalty_enabled}
            help="Penalty for stale features (use negative values)"
          />
        ),
      },
      {
        id: 'stalePenalty_ageThreshold',
        type: 'integer' as const,
        label: 'Age Threshold (days)',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 180 })}
            min={30}
            max={730}
            disabled={!data.stalePenalty_enabled}
            help="Minimum age before staleness applies"
          />
        ),
      },
      {
        id: 'stalePenalty_inactivityThreshold',
        type: 'integer' as const,
        label: 'Inactivity Threshold (days)',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 90 })}
            min={30}
            max={365}
            disabled={!data.stalePenalty_enabled}
            help="Days since last update to apply penalty"
          />
        ),
      },

      // Rejection Penalty
      {
        id: 'rejectionPenalty_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Rejection penalty (has rejection labels)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'rejectionPenalty_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || -50 })}
            min={-100}
            max={0}
            disabled={!data.rejectionPenalty_enabled}
            help="Penalty for rejected features (use negative values)"
          />
        ),
      },

      // Vague Description Penalty
      {
        id: 'vagueDescriptionPenalty_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="Vague description penalty (insufficient detail)"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'vagueDescriptionPenalty_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || -5 })}
            min={-20}
            max={0}
            disabled={!data.vagueDescriptionPenalty_enabled}
            help="Penalty for vague descriptions (use negative values)"
          />
        ),
      },
      {
        id: 'vagueDescriptionPenalty_lengthThreshold',
        type: 'integer' as const,
        label: 'Length Threshold',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 100 })}
            min={50}
            max={500}
            disabled={!data.vagueDescriptionPenalty_enabled}
            help="Minimum character length to avoid penalty"
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
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 70 })}
            min={0}
            max={200}
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
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 50 })}
            min={0}
            max={200}
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
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 30 })}
            min={0}
            max={200}
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
            'Enable and configure individual scoring rules for feature prioritization. Feature labels and rejection labels are configured in the General settings tab.',
          children: [
            {
              id: 'demand-signals',
              label: 'Demand Signals (0-40 points)',
              children: [
                {
                  id: 'reactions',
                  label: 'User Reactions',
                  children: ['reactions_enabled'],
                },
                {
                  id: 'unique-commenters',
                  label: 'Unique Commenters',
                  children: ['uniqueCommenters_enabled'],
                },
                {
                  id: 'me-too-comments',
                  label: '"Me Too" Comments',
                  children: [
                    'meTooComments_enabled',
                    {
                      id: 'me-too-fields',
                      layout: { type: 'row' as const, alignment: 'start' as const },
                      children: [
                        'meTooComments_points',
                        'meTooComments_minimumCount',
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 'engagement-quality',
              label: 'Engagement Quality (0-25 points)',
              children: [
                {
                  id: 'active-discussion',
                  label: 'Active Discussion',
                  children: ['activeDiscussion_enabled'],
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
                        'recentActivity_recentThreshold',
                        'recentActivity_recentPoints',
                        'recentActivity_moderateThreshold',
                        'recentActivity_moderatePoints',
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 'feasibility',
              label: 'Feasibility Indicators (0-15 points)',
              children: [
                {
                  id: 'has-milestone',
                  label: 'Has Milestone',
                  children: [
                    'hasMilestone_enabled',
                    {
                      id: 'milestone-fields',
                      layout: { type: 'row' as const, alignment: 'start' as const },
                      children: ['hasMilestone_points'],
                    },
                  ],
                },
                {
                  id: 'has-assignee',
                  label: 'Has Assignee',
                  children: [
                    'hasAssignee_enabled',
                    {
                      id: 'assignee-fields',
                      layout: { type: 'row' as const, alignment: 'start' as const },
                      children: ['hasAssignee_points'],
                    },
                  ],
                },
              ],
            },
            {
              id: 'user-value',
              label: 'User Value (0-15 points)',
              children: [
                {
                  id: 'author-type',
                  label: 'Author Type',
                  children: [
                    'authorType_enabled',
                    {
                      id: 'author-type-fields',
                      layout: { type: 'row' as const, alignment: 'start' as const },
                      children: [
                        'authorType_teamPoints',
                        'authorType_contributorPoints',
                        'authorType_firstTimePoints',
                      ],
                    },
                  ],
                },
                {
                  id: 'sentiment-analysis',
                  label: 'Sentiment Intensity',
                  children: [
                    'sentimentAnalysis_enabled',
                    {
                      id: 'sentiment-fields',
                      layout: { type: 'row' as const, alignment: 'start' as const },
                      children: ['sentimentAnalysis_maxPoints'],
                    },
                  ],
                },
              ],
            },
            {
              id: 'penalties',
              label: 'Penalties',
              children: [
                {
                  id: 'stale-penalty',
                  label: 'Stale Feature',
                  children: [
                    'stalePenalty_enabled',
                    {
                      id: 'stale-penalty-fields',
                      layout: { type: 'row' as const, alignment: 'start' as const },
                      children: [
                        'stalePenalty_points',
                        'stalePenalty_ageThreshold',
                        'stalePenalty_inactivityThreshold',
                      ],
                    },
                  ],
                },
                {
                  id: 'rejection-penalty',
                  label: 'Rejection Labels',
                  children: [
                    'rejectionPenalty_enabled',
                    {
                      id: 'rejection-penalty-fields',
                      layout: { type: 'row' as const, alignment: 'start' as const },
                      children: ['rejectionPenalty_points'],
                    },
                  ],
                },
                {
                  id: 'vague-description-penalty',
                  label: 'Vague Description',
                  children: [
                    'vagueDescriptionPenalty_enabled',
                    {
                      id: 'vague-description-fields',
                      layout: { type: 'row' as const, alignment: 'start' as const },
                      children: [
                        'vagueDescriptionPenalty_points',
                        'vagueDescriptionPenalty_lengthThreshold',
                      ],
                    },
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

export default FeatureRequestForm;
