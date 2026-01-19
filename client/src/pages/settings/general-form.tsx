import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { DataForm, useFormValidity } from '@wordpress/dataviews';
import {
  TextControl,
  TextareaControl,
  ToggleControl,
  SelectControl,
  Button,
  Notice,
} from '@wordpress/components';
import { useParams } from 'react-router-dom';
import {
  flattenGeneralSettings,
  unflattenGeneralSettings,
  flattenLLMSettings,
  unflattenLLMSettings,
} from './settings-helpers';
import { validateLLMApiKey } from '@/data/api/settings/fetchers';
import type { RepoSettings } from '@/data/api/settings/types';
import { API_KEY_SENTINEL, isApiKeySet, isApiKeyEmpty } from '@/data/api/settings/constants';

type FlattenedSettings = Record<string, string | number | boolean | string[]>;

interface FieldEditProps {
  data: FlattenedSettings;
  field: { id: string; label: string; type: string };
  onChange: (updates: Partial<FlattenedSettings>) => void;
}

// API Key field with internal validation state
function ApiKeyField({ data, field, onChange }: FieldEditProps) {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  // Track if user wants to change the key
  const [isChanging, setIsChanging] = useState(false);
  const apiKeyValue = data.llm_apiKey as string;
  const isSet = isApiKeySet(apiKeyValue);
  const prevApiKeyValueRef = useRef(apiKeyValue);

  // Reset isChanging when value changes FROM non-sentinel TO sentinel (after save)
  useEffect(() => {
    const prevValue = prevApiKeyValueRef.current;

    // Only reset if value changed from something else to sentinel
    if (apiKeyValue === API_KEY_SENTINEL && prevValue !== API_KEY_SENTINEL) {
      setIsChanging(false);
      setValidationResult(null);
    }

    prevApiKeyValueRef.current = apiKeyValue;
  }, [apiKeyValue]);

  const handleValidate = async () => {
    const apiKey = data.llm_apiKey as string;
    const provider = data.llm_provider as 'anthropic' | 'openai';
    const model = data.llm_model as string;

    if (!owner || !repo) return;

    // Allow validating with sentinel (will test existing key)
    if (!isSet && isApiKeyEmpty(apiKey)) {
      setValidationResult({
        success: false,
        message: 'Please enter an API key first',
      });
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      const result = await validateLLMApiKey(owner, repo, {
        provider,
        apiKey,
        model: model || undefined,
      });

      setValidationResult({
        success: result.valid,
        message: result.valid
          ? `API key is valid! Using model: ${result.model}`
          : result.error || 'Validation failed',
      });
    } catch (error) {
      setValidationResult({
        success: false,
        message: 'Validation request failed. Please try again.',
      });
    } finally {
      setValidating(false);
    }
  };

  const handleClearKey = () => {
    // Don't change the value yet, just show the input field
    // Value will be updated when user actually types
    setIsChanging(true);
    setValidationResult(null);
  };

  const handleChange = (value: string | boolean | undefined) => {
    // When user types, update the value
    onChange({ [field.id]: value });
    if (!isChanging) {
      setIsChanging(true);
    }
    if (validationResult) {
      setValidationResult(null);
    }
  };

  const handleCancel = () => {
    onChange({ [field.id]: API_KEY_SENTINEL });
    setIsChanging(false);
    setValidationResult(null);
  };

  return (
    <div>
      {isSet && !isChanging ? (
        // Show "already set" indicator
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            {field.label}
          </label>
          <div
            style={{
              padding: '0.5rem',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ddd',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: '#666', fontFamily: 'monospace' }}>
              API Key: {API_KEY_SENTINEL}
            </span>
            <Button
              variant="secondary"
              size="small"
              onClick={handleClearKey}
              disabled={!data.llm_enabled}
            >
              Change Key
            </Button>
          </div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
            Your API key is securely stored. Click "Change Key" to update it.
          </p>
        </div>
      ) : (
        // Show input field
        <TextControl
          label={field.label}
          type="password"
          value={isSet ? '' : apiKeyValue || ''}
          onChange={handleChange}
          help="Your API key is stored securely in the database."
          placeholder="sk-..."
          disabled={!data.llm_enabled}
        />
      )}

      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
        <Button
          variant="secondary"
          onClick={handleValidate}
          isBusy={validating}
          disabled={
            !data.llm_enabled ||
            validating ||
            (!isSet && isApiKeyEmpty(apiKeyValue))
          }
        >
          {validating
            ? 'Validating...'
            : isSet && !isChanging
            ? 'Test Saved Key'
            : 'Test API Key'}
        </Button>

        {isChanging && isSet && (
          <Button variant="tertiary" onClick={handleCancel}>
            Cancel
          </Button>
        )}
      </div>

      {validationResult && (
        <div style={{ marginTop: '0.75rem' }}>
          <Notice
            status={validationResult.success ? 'success' : 'error'}
            isDismissible={false}
          >
            {validationResult.message}
          </Notice>
        </div>
      )}
    </div>
  );
}

interface RepoInfo {
  url: string;
  description: string;
}

interface GeneralFormProps {
  settings: RepoSettings;
  onChange: (settings: RepoSettings) => void;
  isGithub?: boolean;
  repoInfo?: RepoInfo;
  onRepoInfoChange?: (field: 'url' | 'description', value: string) => void;
  onValidityChange?: (isValid: boolean) => void;
}

function GeneralForm({ settings, onChange, isGithub = true, repoInfo, onRepoInfoChange, onValidityChange }: GeneralFormProps) {
  // Flatten for DataForm (GitHub repos)
  const flatData = useMemo(
    () => ({
      ...flattenGeneralSettings(settings.general),
      ...flattenLLMSettings(settings.llm || {
        enabled: false,
        provider: 'anthropic',
        apiKey: '',
        model: ''
      }),
      // Include repo info for custom repos
      ...(repoInfo ? {
        repo_url: repoInfo.url,
        repo_description: repoInfo.description,
      } : {}),
    }),
    [settings, repoInfo]
  );

  // Handle changes from DataForm
  const handleChange = useCallback(
    (edits: Partial<FlattenedSettings>) => {
      // Handle repo info changes for custom repos
      if ('repo_url' in edits && onRepoInfoChange) {
        onRepoInfoChange('url', edits.repo_url as string);
        return;
      }
      if ('repo_description' in edits && onRepoInfoChange) {
        onRepoInfoChange('description', edits.repo_description as string);
        return;
      }

      const hasLLMChanges = Object.keys(edits).some(key => key.startsWith('llm_'));

      if (hasLLMChanges) {
        const currentLLM = settings.llm || {
          enabled: false,
          provider: 'anthropic',
          apiKey: '',
          model: ''
        };
        const updatedLLM = unflattenLLMSettings(edits, currentLLM);
        onChange({ ...settings, llm: updatedLLM });
      } else {
        const updated = unflattenGeneralSettings(edits, settings.general);
        onChange({ ...settings, general: updated });
      }
    },
    [settings, onChange, onRepoInfoChange]
  );

  // Field definitions
  const fields = useMemo(
    () => [
      // Repository Info fields (for custom repos only)
      {
        id: 'repo_url',
        type: 'text' as const,
        label: 'Repository URL',
        isValid: {
          required: true,
        },
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <TextControl
            label={field.label}
            value={data[field.id] as string || ''}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
            help="The URL to your repository or issue tracker"
            placeholder="https://github.com/org/repo"
          />
        ),
      },
      {
        id: 'repo_description',
        type: 'text' as const,
        label: 'Description',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <TextareaControl
            label={field.label}
            value={data[field.id] as string || ''}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
            help="A brief description of this repository"
            placeholder="Enter a description..."
            rows={3}
          />
        ),
      },
      // LLM Configuration Fields
      {
        id: 'llm_enabled',
        type: 'checkbox' as const,
        label: 'Enable Sentiment Analysis',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <ToggleControl
            label={field.label}
            checked={!!data[field.id]}
            onChange={(value: boolean) => onChange({ [field.id]: value })}
            help="Enable AI-powered sentiment analysis for bugs and feature requests."
          />
        ),
      },
      {
        id: 'llm_provider',
        type: 'text' as const,
        label: 'LLM Provider',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <SelectControl
            label={field.label}
            value={data[field.id] as string}
            onChange={(value: string) => onChange({ [field.id]: value })}
            options={[
              { label: 'Anthropic (Claude)', value: 'anthropic' },
              { label: 'OpenAI (GPT)', value: 'openai' },
            ]}
            help="Choose your AI provider."
            disabled={!data.llm_enabled}
          />
        ),
      },
      {
        id: 'llm_apiKey',
        type: 'text' as const,
        label: 'API Key',
        Edit: ApiKeyField,
      },
      {
        id: 'llm_model',
        type: 'text' as const,
        label: 'Model Name (Optional)',
        Edit: ({ data, field, onChange }: FieldEditProps) => (
          <TextControl
            label={field.label}
            value={data[field.id] as string}
            onChange={(value: string | boolean | undefined) => onChange({ [field.id]: value })}
            help="Leave empty for defaults: claude-3-haiku-20240307 (Anthropic) or gpt-3.5-turbo (OpenAI)"
            placeholder="claude-3-haiku-20240307"
            disabled={!data.llm_enabled}
          />
        ),
      },

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

  // Form layout - different for GitHub vs custom repos
  const form = useMemo(
    () => {
      // Custom repos: only show Repository Info card
      if (!isGithub) {
        return {
          layout: { type: 'card' as const },
          fields: [
            {
              id: 'repository-info',
              label: 'Repository Information',
              description: 'Basic information about your custom repository.',
              children: ['repo_url', 'repo_description'],
            },
          ],
        };
      }

      // GitHub repos: show all the GitHub-specific cards
      return {
        layout: { type: 'card' as const },
        fields: [
          {
            id: 'llm-configuration',
            label: 'AI Sentiment Analysis',
            description: (
              <div>
                <p style={{ marginBottom: '0.5rem' }}>Configure AI-powered sentiment analysis to help prioritize bugs and feature requests.</p>
                <div style={{ marginTop: '0.5rem' }}>
                  <Notice status="warning" isDismissible={false}>
                    <strong>Important:</strong> API calls to your provider will incur costs. Monitor your usage carefully.
                  </Notice>
                </div>
              </div>
            ),
            children: ['llm_enabled', 'llm_provider', 'llm_apiKey', 'llm_model'],
          },
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
      };
    },
    [isGithub]
  );

  // Check form validity for custom repos
  const { isValid } = useFormValidity(flatData, fields, form);

  // Notify parent of validity changes
  useEffect(() => {
    if (onValidityChange && !isGithub) {
      onValidityChange(isValid);
    }
  }, [isValid, isGithub, onValidityChange]);

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
