import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus } from '../tenant/tenant.entity';
import { provisionTenantSchema } from '../database/provision-tenant';
import { PlatformAuditService } from './platform-audit.service';
import {
  CreateTenantDto,
  UpdateTenantModulesDto,
  UpdateTenantProfileDto,
  UpdateTenantSlugDto,
  UpdateTenantStatusDto,
} from './dto/platform-admin.dto';

@Injectable()
export class PlatformTenantsService {
  constructor(
    @InjectRepository(Tenant, 'control')
    private tenantRepo: Repository<Tenant>,
    private auditService: PlatformAuditService,
    private config: ConfigService,
  ) {}

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  /**
   * Full onboarding via API, equivalent to the seed:tenant CLI script -
   * both call the same provisionTenantSchema function underneath.
   */
  async create(dto: CreateTenantDto, platformAdminId: string): Promise<Tenant> {
    const existing = await this.tenantRepo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" is already in use`);
    }

    const schemaName = `tenant_${dto.slug.replace(/-/g, '_')}`;

    const tenant = await this.tenantRepo.save(
      this.tenantRepo.create({
        slug: dto.slug,
        name: dto.name,
        type: dto.type,
        schemaName,
        dataResidencyRegion: dto.dataResidencyRegion,
        licensedModules: ['hms'],
      }),
    );

    await provisionTenantSchema(
      {
        host: this.config.get('TENANT_DB_HOST') ?? 'localhost',
        port: this.config.get<number>('TENANT_DB_PORT') ?? 5432,
        username: this.config.get('TENANT_DB_USER') ?? 'hms_admin',
        password: this.config.get('TENANT_DB_PASSWORD') ?? 'changeme',
        database: this.config.get('TENANT_DB_NAME') ?? 'hms_tenants',
      },
      schemaName,
    );

    await this.auditService.record({
      platformAdminId,
      action: 'tenant.created',
      targetTenantId: tenant.id,
      metadata: { slug: tenant.slug, name: tenant.name, type: tenant.type },
    });

    return tenant;
  }

  /**
   * Renaming (and other cosmetic profile fields) - exactly the "how
   * easy is it to rename a hospital" case. One row update, no schema
   * touched, no data migration, existing sessions unaffected.
   */
  async updateProfile(id: string, dto: UpdateTenantProfileDto, platformAdminId: string): Promise<Tenant> {
    const tenant = await this.findOne(id);
    const before = { name: tenant.name, dataResidencyRegion: tenant.dataResidencyRegion };

    Object.assign(tenant, dto);
    const saved = await this.tenantRepo.save(tenant);

    await this.auditService.record({
      platformAdminId,
      action: 'tenant.profile_updated',
      targetTenantId: tenant.id,
      metadata: { before, after: dto },
    });

    return saved;
  }

  /**
   * Deliberately separate from updateProfile - see the comment on
   * UpdateTenantSlugDto. The schema name is NOT changed here (it stays
   * whatever it was at creation), only the routing key changes. Existing
   * staff/patient JWTs remain valid since auth checks tenantId, not slug
   * (see JwtAuthGuard/PatientJwtAuthGuard) - but anyone with the OLD
   * subdomain bookmarked will get a 404 after this change, so this is
   * an operational event to communicate to the client, not just a
   * database update.
   */
  async updateSlug(id: string, dto: UpdateTenantSlugDto, platformAdminId: string): Promise<Tenant> {
    const tenant = await this.findOne(id);

    const existing = await this.tenantRepo.findOne({ where: { slug: dto.newSlug } });
    if (existing && existing.id !== id) {
      throw new ConflictException(`Slug "${dto.newSlug}" is already in use`);
    }

    const oldSlug = tenant.slug;
    tenant.slug = dto.newSlug;
    const saved = await this.tenantRepo.save(tenant);

    await this.auditService.record({
      platformAdminId,
      action: 'tenant.slug_changed',
      targetTenantId: tenant.id,
      metadata: { oldSlug, newSlug: dto.newSlug },
    });

    return saved;
  }

  async updateStatus(id: string, dto: UpdateTenantStatusDto, platformAdminId: string): Promise<Tenant> {
    const tenant = await this.findOne(id);
    const previousStatus = tenant.status;
    tenant.status = dto.status;
    const saved = await this.tenantRepo.save(tenant);

    await this.auditService.record({
      platformAdminId,
      action: 'tenant.status_changed',
      targetTenantId: tenant.id,
      metadata: { from: previousStatus, to: dto.status, reason: dto.reason },
    });

    return saved;
  }

  async updateModules(id: string, dto: UpdateTenantModulesDto, platformAdminId: string): Promise<Tenant> {
    const tenant = await this.findOne(id);
    const before = tenant.licensedModules;
    tenant.licensedModules = dto.licensedModules;
    const saved = await this.tenantRepo.save(tenant);

    await this.auditService.record({
      platformAdminId,
      action: 'tenant.modules_changed',
      targetTenantId: tenant.id,
      metadata: { before, after: dto.licensedModules },
    });

    return saved;
  }
}
