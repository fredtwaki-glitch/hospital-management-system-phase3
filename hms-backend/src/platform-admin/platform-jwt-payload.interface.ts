/**
 * A THIRD distinct token shape, alongside auth/jwt-payload.interface.ts
 * (staff, scoped to one tenant) and patient-portal/patient-jwt-payload
 * (patient, scoped to one tenant + one patient). This one carries no
 * tenantId at all - a platform admin isn't "inside" any single tenant,
 * they operate across all of them. Uses its own secret
 * (PLATFORM_JWT_SECRET) so a leak of any one of the three token types
 * doesn't compromise the other two.
 */
export interface PlatformJwtPayload {
  sub: string; // platform admin id
  scope: 'platform_admin';
  email: string;
}
