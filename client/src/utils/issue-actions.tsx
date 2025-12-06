import { __ } from '@wordpress/i18n';
import { Icon, backup } from '@wordpress/icons';
import { refreshSingleIssue } from '@/data/api/issues/mutators';

interface Issue {
  number: number;
  id: number;
  [key: string]: any;
}

/**
 * Create a refresh action for a specific repository
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param onSuccess - Callback when refresh completes
 */
export const createRefreshIssueAction = (owner: string, repo: string, onSuccess?: () => void) => ({
  id: 'refresh-issue',
  label: __('Refresh from GitHub'),
  icon: <Icon icon={backup} />,
  isPrimary: false,
  callback: async (items: Issue[]) => {
    if (items.length !== 1) {
      return; // Only works for single items
    }

    const issue = items[0];

    try {
      await refreshSingleIssue(owner, repo, issue.number);

      // Trigger callback to reload data
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to refresh issue:', error);
    }
  },
  isEligible: () => {
    // Always eligible for all issues
    return true;
  },
  supportsBulk: false,
});
