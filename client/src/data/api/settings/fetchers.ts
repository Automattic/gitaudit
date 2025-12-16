import { apiClient } from '../client';
import { RepoSettings } from './types';

/**
 * Fetch repository settings
 */
export const fetchRepoSettings = async (
  owner: string,
  repo: string
): Promise<RepoSettings> => {
  return apiClient.get<RepoSettings>(`/api/repos/${owner}/${repo}/issues/settings`);
};

/**
 * Validate LLM API key
 */
export interface ValidateLLMRequest {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model?: string;
}

export interface ValidateLLMResponse {
  valid: boolean;
  message?: string;
  model?: string;
  error?: string;
  details?: string;
}

export const validateLLMApiKey = async (
  owner: string,
  repo: string,
  request: ValidateLLMRequest
): Promise<ValidateLLMResponse> => {
  return apiClient.post<ValidateLLMResponse>(
    `/api/repos/${owner}/${repo}/issues/settings/validate-llm`,
    request
  );
};
