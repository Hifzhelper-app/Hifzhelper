/* Hifzhelper build 4.2.15.27 | worker/src/profile-ownership.js */
// Academy ownership is a deployment policy, independent of the journal-ID
// cutover. The receipt also keeps migrated databases Academy-owned, including
// inactive legacy profiles, if their deployment setting is later omitted.
export async function academyOwnsProfiles(env) {
  if (env.PROFILE_AUTHORITY === 'academy') return true;
  return Boolean(await env.DB.prepare('SELECT migration_id FROM academy_identity_migrations LIMIT 1').first());
}
export const academyManagedError = () => ({
  error: 'Manage user profiles and registration through Academy.',
  status: 403,
  code: 'ACADEMY_MANAGED'
});
