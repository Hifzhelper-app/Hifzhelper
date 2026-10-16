/* Hifzhelper build 4.2.15.26 | worker/src/profile-ownership.js */
// The receipt is written in the same transaction as the identity cutover.
// Once present, all shared identity administration belongs to Academy,
// including legacy inactive rows retained for historical journals.
export async function academyOwnsProfiles(env) {
  return Boolean(await env.DB.prepare('SELECT migration_id FROM academy_identity_migrations LIMIT 1').first());
}
export const academyManagedError = () => ({
  error: 'Manage user profiles and registration through Academy.',
  status: 403,
  code: 'ACADEMY_MANAGED'
});
