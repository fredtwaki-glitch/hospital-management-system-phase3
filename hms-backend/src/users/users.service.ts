import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User, UserRole } from './user.entity';

export interface StaffDirectoryEntry {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  staffNumber: string;
  department: string | null;
}

@Injectable()
export class UsersService {
  /**
   * Deliberately hand-picks fields rather than returning the User
   * entity directly - this is a staff directory (e.g. for picking a
   * provider when scheduling), not an admin export. passwordHash,
   * email, and licenseNumber are never included here.
   */
  async findAll(tenantDataSource: DataSource, role?: UserRole): Promise<StaffDirectoryEntry[]> {
    const repo = tenantDataSource.getRepository(User);
    const users = await repo.find({
      where: { isActive: true, ...(role ? { role } : {}) },
      order: { lastName: 'ASC' },
    });
    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      staffNumber: u.staffNumber,
      department: u.department ?? null,
    }));
  }
}
