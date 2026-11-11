/**
 * Deliberately a DIFFERENT shape from auth/jwt-payload.interface.ts
 * (staff tokens). A patient token can never be used against staff
 * routes and vice versa - PatientJwtAuthGuard checks for `scope` below
 * rather than trusting role alone, so a patient token can't be replayed
 * against a staff-only endpoint even if the secret were shared.
 */
export interface PatientJwtPayload {
  sub: string; // patient id
  tenantId: string;
  tenantSlug: string;
  scope: 'patient_portal';
}
