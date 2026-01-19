import { useMemo, useCallback } from 'react';
import { DataForm } from '@wordpress/dataviews';
import {
  CheckboxControl,
  __experimentalNumberControl as NumberControl,
} from '@wordpress/components';
import {
  flattenCommunityHealthSettings,
  unflattenCommunityHealthSettings,
} from './settings-helpers';
import type { RepoSettings } from '@/data/api/settings/types';

type CommunityHealthSettings = RepoSettings['community'];
type FlattenedSettings = Record<string, string | number | boolean | string[]>;

interface FieldEditProps {
  data: FlattenedSettings;
  field: { id: string; label: string; type?: string };
  onChange: (updates: Partial<FlattenedSettings>) => void;
}

interface CommunityHealthFormProps {
  settings: CommunityHealthSettings;
  onChange: (settings: CommunityHealthSettings) => void;
}

function CommunityHealthForm({ settings, onChange }: CommunityHealthFormProps) {
  // Flatten for DataForm
  const flatData = useMemo(
    () => flattenCommunityHealthSettings(settings),
    [settings]
  );

  // Handle changes from DataForm
  const handleChange = useCallback(
    (edits: Partial<FlattenedSettings>) => {
      const updated = unflattenCommunityHealthSettings(edits, settings);
      onChange(updated);
    },
    [settings, onChange]
  );

  // Field definitions
  const fields = useMemo(
    () => [
      // First-Time Contributor
      {
        id: 'firstTimeContributor_enabled',
        type: 'text' as const,
        label: 'Enable',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <CheckboxControl
            label="First-time contributors without maintainer response"
            checked={data[field.id] as boolean}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'firstTimeContributor_points',
        type: 'integer' as const,
        label: 'Points',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <NumberControl
            label={field.label}
            value={data[field.id] as string | number | undefined}
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 0 })}
            min={0}
            max={200}
            disabled={!data.firstTimeContributor_enabled}
            help="Points added when first-time contributor ignored"
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
            label='"Me too" pile-ons without maintainer response'
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
            max={200}
            disabled={!data.meTooComments_enabled}
            help="Points added when threshold met"
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
            max={100}
            disabled={!data.meTooComments_enabled}
            help="Minimum 'me too' comments required"
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
            label="Sentiment analysis"
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
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 30 })}
            min={0}
            max={50}
            disabled={!data.sentimentAnalysis_enabled}
            help="Maximum points from negative sentiment"
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
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 60 })}
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
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 40 })}
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
            onChange={(value: string | undefined) => onChange({ [field.id]: parseInt(value || '0') || 20 })}
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
            'Enable and configure individual scoring rules for community health detection. Maintainer team configuration is in the General settings tab.',
          children: [
            {
              id: 'first-time-contributor',
              label: 'First-Time Contributor',
              description:
                'Detects when new contributors do not receive maintainer responses',
              children: [
                'firstTimeContributor_enabled',
                'firstTimeContributor_points',
              ],
            },
            {
              id: 'me-too-comments',
              label: 'Me Too Comments',
              description:
                'Identifies popular issues with pile-on comments but no maintainer engagement',
              children: [
                'meTooComments_enabled',
                {
                  id: 'me-too-comments-fields',
                  layout: { type: 'row' as const, alignment: 'start' as const },
                  children: [
                    'meTooComments_points',
                    'meTooComments_minimumCount',
                  ],
                },
              ],
            },
            {
              id: 'sentiment-analysis',
              label: 'Sentiment Analysis',
              description:
                'Scores issues based on negative sentiment in comments (requires AI provider)',
              children: [
                'sentimentAnalysis_enabled',
                'sentimentAnalysis_maxPoints',
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

export default CommunityHealthForm;
