import React, { useMemo, useCallback } from 'react';
import { DataForm } from '@wordpress/dataviews';
import {
  CheckboxControl,
  __experimentalNumberControl as NumberControl,
  TextControl,
} from '@wordpress/components';
import {
  flattenCommunityHealthSettings,
  unflattenCommunityHealthSettings,
} from './settingsHelpers';

function CommunityHealthForm({ settings, onChange }) {
  // Flatten for DataForm
  const flatData = useMemo(
    () => flattenCommunityHealthSettings(settings),
    [settings]
  );

  // Handle changes from DataForm
  const handleChange = useCallback(
    (edits) => {
      const updated = unflattenCommunityHealthSettings(edits, settings);
      onChange(updated);
    },
    [settings, onChange]
  );

  // Field definitions
  const fields = useMemo(
    () => [
      // Maintainer Team Configuration
      {
        id: 'maintainerTeam_org',
        type: 'text',
        label: 'GitHub Organization',
        Edit: ({ data, field, onChange }) => (
          <TextControl
            label={field.label}
            value={data[field.id]}
            onChange={(value) => onChange({ [field.id]: value })}
            help="GitHub organization login (e.g., 'facebook')"
            placeholder="organization-name"
          />
        ),
      },
      {
        id: 'maintainerTeam_teamSlug',
        type: 'text',
        label: 'Team Slug',
        Edit: ({ data, field, onChange }) => (
          <TextControl
            label={field.label}
            value={data[field.id]}
            onChange={(value) => onChange({ [field.id]: value })}
            help="GitHub team slug (e.g., 'react-core')"
            placeholder="team-slug"
          />
        ),
      },

      // First-Time Contributor
      {
        id: 'firstTimeContributor_enabled',
        type: 'text',
        label: 'Enable',
        Edit: ({ data, field, onChange }) => (
          <CheckboxControl
            label="First-time contributors without maintainer response"
            checked={data[field.id]}
            onChange={(value) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'firstTimeContributor_points',
        type: 'integer',
        label: 'Points',
        Edit: ({ data, field, onChange }) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value) => onChange({ [field.id]: parseInt(value) || 0 })}
            min={0}
            max={200}
            disabled={!data.firstTimeContributor_enabled}
          />
        ),
      },

      // Me Too Comments
      {
        id: 'meTooComments_enabled',
        type: 'text',
        label: 'Enable',
        Edit: ({ data, field, onChange }) => (
          <CheckboxControl
            label='"Me too" pile-ons without maintainer response'
            checked={data[field.id]}
            onChange={(value) => onChange({ [field.id]: value })}
          />
        ),
      },
      {
        id: 'meTooComments_points',
        type: 'integer',
        label: 'Points',
        Edit: ({ data, field, onChange }) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value) => onChange({ [field.id]: parseInt(value) || 0 })}
            min={0}
            max={200}
            disabled={!data.meTooComments_enabled}
          />
        ),
      },
      {
        id: 'meTooComments_minimumCount',
        type: 'integer',
        label: 'Minimum Count',
        Edit: ({ data, field, onChange }) => (
          <NumberControl
            label={field.label}
            value={data[field.id]}
            onChange={(value) => onChange({ [field.id]: parseInt(value) || 3 })}
            min={1}
            max={100}
            disabled={!data.meTooComments_enabled}
            help="Minimum number of 'me too' style comments"
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
            label="Sentiment analysis"
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
            help="Maximum points from sentiment (0-30 range)"
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
            onChange={(value) => onChange({ [field.id]: parseInt(value) || 60 })}
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
            onChange={(value) => onChange({ [field.id]: parseInt(value) || 40 })}
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
            onChange={(value) => onChange({ [field.id]: parseInt(value) || 20 })}
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
          id: 'maintainer-team',
          label: 'Maintainer Team Configuration',
          description:
            'Configure the GitHub team used to identify maintainers. Leave empty to disable maintainer-based scoring.',
          layout: { type: 'card' },
          children: [
            {
              id: 'team-fields',
              layout: { type: 'row' },
              children: ['maintainerTeam_org', 'maintainerTeam_teamSlug'],
            },
          ],
        },
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
            'Enable and configure individual scoring rules for community health detection.',
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
                  layout: { type: 'row' },
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
