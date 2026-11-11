import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformAuditLog } from './platform-audit-log.entity';

@Injectable()
export class PlatformAuditService {
  constructor(
    @InjectRepository(PlatformAuditLog, 'control')
    private auditRepo: Repository<PlatformAuditLog>,
  ) {}

  async record(entry: {
    platformAdminId: string;
    action: string;
    targetTenantId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.auditRepo.save(this.auditRepo.create(entry));
  }
}
