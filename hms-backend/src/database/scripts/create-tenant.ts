import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { ControlDataSource } from '../data-source';
import { Tenant, TenantType } from '../../tenant/tenant.entity';
import { provisionTenantSchema } from '../provision-tenant';

dotenv.config();

/**
 * Onboarding script for a new client. Run as:
 *   npm run seed:tenant -- --slug=acme-hospital --name="Acme Hospital" --type=hospital
 *
 * Steps:
 *  1. Register the tenant in the control-plane DB.
 *  2. Create its dedicated Postgres schema and run every tenant-schema
 *     migration against it (via the shared provisionTenantSchema
 *     function - also used by the platform admin API's tenant-create
 *     endpoint, so there's one implementation of this logic).
 *
 * Equivalent to POST /platform/tenants via the platform admin API -
 * this script remains useful for local dev / first-tenant bootstrap
 * before a platform admin account even exists.
 */
async function main() {
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const { slug, name, type } = args;

  if (!slug || !name || !type) {
    console.error('Usage: npm run seed:tenant -- --slug=acme-hospital --name="Acme Hospital" --type=hospital');
    process.exit(1);
  }

  const schemaName = `tenant_${slug.replace(/-/g, '_')}`;

  await ControlDataSource.initialize();

  const tenantRepo = ControlDataSource.getRepository(Tenant);
  const existing = await tenantRepo.findOne({ where: { slug } });
  if (existing) {
    console.error(`Tenant with slug "${slug}" already exists.`);
    process.exit(1);
  }

  const tenant = tenantRepo.create({
    slug,
    name,
    type: type as TenantType,
    schemaName,
    licensedModules: ['hms'],
  });
  await tenantRepo.save(tenant);
  console.log(`Registered tenant "${name}" (${slug}) in control DB.`);

  await provisionTenantSchema(
    {
      host: process.env.TENANT_DB_HOST ?? 'localhost',
      port: Number(process.env.TENANT_DB_PORT) || 5432,
      username: process.env.TENANT_DB_USER ?? 'hms_admin',
      password: process.env.TENANT_DB_PASSWORD ?? 'changeme',
      database: process.env.TENANT_DB_NAME ?? 'hms_tenants',
    },
    schemaName,
  );

  console.log(`Provisioned schema "${schemaName}" with base tables.`);
  console.log(`\nNext: create the first admin user via POST /auth/register with header X-Tenant-Slug: ${slug}`);

  await ControlDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
