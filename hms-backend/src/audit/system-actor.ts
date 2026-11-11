/**
 * AuditLog.userId is a required field with no FK constraint (see
 * migrations/tenant/1700000000001-CreateUsersAndAuditLog.ts), so it
 * accepts any UUID-shaped string. Callbacks from Safaricom (or any
 * future webhook-driven action) have no authenticated staff user behind
 * them, so we record this well-known nil UUID instead of inventing a
 * fake user row or making userId nullable everywhere else in the
 * codebase for the sake of one caller.
 */
export const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';
