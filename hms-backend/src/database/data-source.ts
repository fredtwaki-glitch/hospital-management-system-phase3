import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { PlatformAdmin } from '../platform-admin/platform-admin.entity';
import { PlatformAuditLog } from '../platform-admin/platform-audit-log.entity';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Control-plane data source: holds the tenant registry AND now the
 * platform admin accounts + platform-level audit log - all
 * cross-tenant, platform-operator concerns, separate from anything
 * that lives inside an individual hospital's schema.
 */
export const ControlDataSource = new DataSource({
  type: 'postgres',
  host: process.env.CONTROL_DB_HOST,
  port: Number(process.env.CONTROL_DB_PORT) || 5432,
  username: process.env.CONTROL_DB_USER,
  password: process.env.CONTROL_DB_PASSWORD,
  database: process.env.CONTROL_DB_NAME,
  entities: [Tenant, PlatformAdmin, PlatformAuditLog],
  migrations: ['src/database/migrations/control/*.ts'],
  synchronize: false,
  ssl: { rejectUnauthorized: false },
});
