import { __ } from '@wordpress/i18n';
import { Icon, backup } from '@wordpress/icons';
import api from './api';

/**
 * Create a refresh action for a specific repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Function} onSuccess - Callback when refresh completes
 */
export const createRefreshIssueAction = (owner, repo, onSuccess) => ({
  id: 'refresh-issue',
  label: __('Refresh from GitHub'),
  icon: <Icon icon={backup} />,
  isPrimary: false,
  callback: async (items) => {
    if (items.length !== 1) {
      return; // Only works for single items
    }

    const issue = items[0];

    try {
      await api.post(`/api/repos/${owner}/${repo}/issues/${issue.number}/refresh`);

      console.log(`Issue #${issue.number} refresh queued`);

      // Trigger callback to reload data
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to refresh issue:', error);
    }
  },
  isEligible: (item) => {
    // Always eligible for all issues
    return true;
  },
  supportsBulk: false,
  context: 'list', // Show in list view row actions
});
