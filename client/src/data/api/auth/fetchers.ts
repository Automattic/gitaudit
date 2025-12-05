import { apiClient } from '../client';
import { AuthVerifyResponse } from './types';

/**
 * Verify JWT token and get user info
 */
export const fetchAuthVerify = async (): Promise<AuthVerifyResponse> => {
  return apiClient.get<AuthVerifyResponse>('/auth/verify');
};
