import { UserRole } from '../users/user.entity';

/**
 * Every issued token is scoped to exactly one tenant. There is no such
 * thing as a "global" login - this is what prevents a user session from
 * one hospital ever being usable against another hospital's data, even
 * if the JWT secret were somehow reused across environments.
 */
export interface JwtPayload {
  sub: string; // user id
  tenantId: string;
  tenantSlug: string;
  role: UserRole;
  email: string;
  staffNumber: string;
}
