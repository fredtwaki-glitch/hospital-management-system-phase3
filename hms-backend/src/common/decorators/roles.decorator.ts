import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Usage: @Roles(UserRole.ADMIN, UserRole.BILLING_STAFF)
 * Combine with RolesGuard. Coarse role checks live here; anything
 * finer-grained (field-level redaction) belongs in the module itself.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
