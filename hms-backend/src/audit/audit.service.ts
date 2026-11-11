import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  /**
   * Call this from any controller/service after a read or write to a
   * sensitive resource (patient records, invoices, dispensing records).
   * Takes the request's tenantDataSource directly rather than injecting
   * a repository, since the connection is resolved per-request, not
   * at module-bootstrap time.
   */
  async record(
    tenantDataSource: DataSource | EntityManager,
    entry: {
      userId: string;
      action: string;
      resourceType?: string;
      resourceId?: string;
      ipAddress?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const repo = tenantDataSource.getRepository(AuditLog);
    await repo.save(repo.create(entry));
  }
}
