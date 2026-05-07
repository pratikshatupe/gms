/**
 * Store barrel.
 *   import { useCollection, STORAGE_KEYS } from '../../store';
 *
 * The store layer is intentionally tiny: one hook, one constants map.
 * `safeGet` / `safeSet` from `src/utils/storage` remain available for
 * non-React reads (seeding, one-shot writes from non-component code).
 */
export { default as useCollection, SAME_TAB_EVENT } from './useCollection';
export { STORAGE_KEYS } from './keys';
export { useOrgSettings, DEFAULT_ORG_SETTINGS, migrateLegacySettings } from './useOrgSettings';
