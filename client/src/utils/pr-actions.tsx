import { __ } from '@wordpress/i18n';
import { Icon, backup } from '@wordpress/icons';
import { refreshSinglePR } from '@/data/api/prs/mutators';

interface PR {
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
export const createRefreshPRAction = (owner: string, repo: string, onSuccess?: () => void) => ({
  id: 'refresh-pr',
  label: __('Refresh from GitHub'),
  icon: <Icon icon={backup} />,
  isPrimary: false,
  callback: async (items: PR[]) => {
    if (items.length !== 1) {
      return; // Only works for single items
    }

    const pr = items[0];

    try {
      await refreshSinglePR(owner, repo, pr.number);

      // Trigger callback to reload data
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to refresh PR:', error);
    }
  },
  isEligible: () => {
    // Always eligible for all PRs
    return true;
  },
  supportsBulk: false,
});
