import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { CreatePayerDto, UpdatePayerDto } from './dto/payer.dto';
import { Payer } from './payer.entity';

@Injectable()
export class PayersService {
  constructor(private auditService: AuditService) {}

  async create(tenantDataSource: DataSource, dto: CreatePayerDto, actingUserId: string): Promise<Payer> {
    const repo = tenantDataSource.getRepository(Payer);
    const payer = await repo.save(repo.create(dto));

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'payer.created',
      resourceType: 'Payer',
      resourceId: payer.id,
    });

    return payer;
  }

  async findAll(tenantDataSource: DataSource, activeOnly = false): Promise<Payer[]> {
    const repo = tenantDataSource.getRepository(Payer);
    return activeOnly ? repo.find({ where: { isActive: true }, order: { name: 'ASC' } }) : repo.find({ order: { name: 'ASC' } });
  }

  async findOne(tenantDataSource: DataSource, id: string): Promise<Payer> {
    const payer = await tenantDataSource.getRepository(Payer).findOne({ where: { id } });
    if (!payer) {
      throw new NotFoundException('Payer not found');
    }
    return payer;
  }

  async update(tenantDataSource: DataSource, id: string, dto: UpdatePayerDto, actingUserId: string): Promise<Payer> {
    const payer = await this.findOne(tenantDataSource, id);
    Object.assign(payer, dto);
    const saved = await tenantDataSource.getRepository(Payer).save(payer);

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'payer.updated',
      resourceType: 'Payer',
      resourceId: payer.id,
      metadata: { fields: Object.keys(dto) },
    });

    return saved;
  }
}
