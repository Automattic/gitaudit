import { useMemo, useCallback } from 'react';
import { DataForm } from '@wordpress/dataviews';
import {
  TextControl,
  TextareaControl,
} from '@wordpress/components';
import {
  flattenGeneralSettings,
  unflattenGeneralSettings,
} from './settings-helpers';
import type { RepoSettings } from '@/data/api/settings/types';

type GeneralSettings = RepoSettings['general'];
type FlattenedSettings = Record<string, string | number | boolean | string[]>;

interface FieldEditProps {
  data: FlattenedSettings;
  field: { id: string; label: string; type: string };
  onChange: (updates: Partial<FlattenedSettings>) => void;
}

interface GeneralFormProps {
  settings: GeneralSettings;
  onChange: (settings: GeneralSettings) => void;
}

function GeneralForm({ settings, onChange }: GeneralFormProps) {
  // Flatten for DataForm
  const flatData = useMemo(
    () => flattenGeneralSettings(settings),
    [settings]
  );

  // Handle changes from DataForm
  const handleChange = useCallback(
    (edits: Partial<FlattenedSettings>) => {
      const updated = unflattenGeneralSettings(edits, settings);
      onChange(updated);
    },
    [settings, onChange]
  );

  // Field definitions
  const fields = useMemo(
    () => [
      // Bug Labels
      {
        id: 'labels_bug',
        type: 'text' as const,
        label: 'Bug Labels',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <TextareaControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
            help="Comma-separated list of bug label keywords (case-insensitive partial match). Used to identify which issues are bugs."
            placeholder="bug, defect, error, crash, broken"
            rows={2}
          />
        ),
      },

      // Feature Labels
      {
        id: 'labels_feature',
        type: 'text' as const,
        label: 'Feature Labels',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <TextareaControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
            help="Comma-separated list of feature request label keywords (case-insensitive partial match). Used to identify which issues are feature requests."
            placeholder="enhancement, feature, feature request"
            rows={2}
          />
        ),
      },

      // High Priority Labels
      {
        id: 'labels_highPriority',
        type: 'text' as const,
        label: 'High Priority Labels',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <TextareaControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
            help="Comma-separated list of high priority label keywords (case-insensitive partial match). Scoring rules (enabled/points) are configured in Important Bugs settings."
            placeholder="critical, high priority, urgent, p0, p1"
            rows={2}
          />
        ),
      },

      // Low Priority Labels
      {
        id: 'labels_lowPriority',
        type: 'text' as const,
        label: 'Low Priority Labels',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <TextareaControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
            help="Comma-separated list of low priority label keywords (case-insensitive partial match). Used for negative scoring in Important Bugs and rejection penalty in Feature Requests."
            placeholder="priority low, low priority"
            rows={2}
          />
        ),
      },

      // Maintainer Team - Org
      {
        id: 'maintainerTeam_org',
        type: 'text' as const,
        label: 'GitHub Organization',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <TextControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
            help="GitHub organization login (e.g., 'facebook')"
            placeholder="organization-name"
          />
        ),
      },
      // Maintainer Team - Team Slug
      {
        id: 'maintainerTeam_teamSlug',
        type: 'text' as const,
        label: 'Team Slug',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <TextControl
            label={field.label}
            value={data[field.id]}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
            help="GitHub team slug (e.g., 'react-core')"
            placeholder="team-slug"
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
          id: 'label-keywords',
          label: 'Label Keywords',
          description:
            'Define global label keywords used across different scoring types. These control issue classification and prioritization.',
          children: [
            'labels_bug',
            'labels_feature',
            'labels_highPriority',
            'labels_lowPriority',
          ],
        },
        {
          id: 'team-configuration',
          label: 'Team Configuration',
          description:
            'Configure the GitHub team used to identify maintainers. Used in Community Health scoring and job processing.',
          children: [
            {
              id: 'maintainer-team-fields',
              layout: { type: 'row' as const, alignment: 'start' as const },
              children: ['maintainerTeam_org', 'maintainerTeam_teamSlug'],
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

export default GeneralForm;
