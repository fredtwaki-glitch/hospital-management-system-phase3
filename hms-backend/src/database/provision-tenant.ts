import { DataSource } from 'typeorm';
import { TENANT_SCHEMA_ENTITIES } from './tenant-entities';

/**
 * Creates a tenant's Postgres schema and runs every tenant-schema
 * migration against it. Deliberately framework-agnostic (no Nest DI) -
 * both the standalone CLI script (src/database/scripts/create-tenant.ts,
 * run outside the running app) and PlatformTenantsService (running
 * inside the app, for the platform admin API) call this exact function,
 * so there's exactly one implementation of "what does provisioning a
 * new tenant's schema actually do."
 */
export async function provisionTenantSchema(env: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}, schemaName: string): Promise<void> {
  if (!/^tenant_[a-z0-9_]+$/.test(schemaName)) {
    throw new Error('Invalid tenant schema name');
  }

  const dataSource = new DataSource({
    type: 'postgres',
    schema: schemaName,
    extra: { options: `-c search_path=${schemaName}` },
    host: env.host,
    port: env.port,
    username: env.username,
    password: env.password,
    database: env.database,
    entities: TENANT_SCHEMA_ENTITIES,
    migrations: ['src/database/migrations/tenant/*.ts'],
    synchronize: false,
  });

  await dataSource.initialize();
  await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  await dataSource.query(`SET search_path TO "${schemaName}"`);
  await dataSource.runMigrations();
  await dataSource.destroy();
}
