/**
 * Shared utility for unlocking private WordPress components.
 * This ensures we only opt-in once across the entire application.
 */
import { __dangerousOptInToUnstableAPIsOnlyForCoreModules } from '@wordpress/private-apis';
import { privateApis as componentsPrivateApis } from '@wordpress/components';

const { unlock } = __dangerousOptInToUnstableAPIsOnlyForCoreModules(
  "I acknowledge private features are not for use in themes or plugins and doing so will break in the next version of WordPress.",
  "@wordpress/components"
);

const { Tabs, Badge } = unlock(componentsPrivateApis);

export { Tabs, Badge };
