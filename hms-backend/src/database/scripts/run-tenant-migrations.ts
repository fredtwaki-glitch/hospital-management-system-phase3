import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { TENANT_SCHEMA_ENTITIES } from '../tenant-entities';

dotenv.config();

async function main() {
  const schemaArg = process.argv.find((arg) => arg.startsWith('--schema='));
  const schemaName = schemaArg?.split('=')[1];
  if (!schemaName || !/^tenant_[a-z0-9_]+$/.test(schemaName)) {
    throw new Error('Provide a valid tenant schema using --schema=tenant_schema_name');
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.TENANT_DB_HOST,
    port: Number(process.env.TENANT_DB_PORT) || 5432,
    username: process.env.TENANT_DB_USER,
    password: process.env.TENANT_DB_PASSWORD,
    database: process.env.TENANT_DB_NAME,
    schema: schemaName,
    extra: { options: `-c search_path=${schemaName}` },
    entities: TENANT_SCHEMA_ENTITIES,
    migrations: ['src/database/migrations/tenant/*.ts'],
    synchronize: false,
    migrationsTableName: 'migrations',
  });

  try {
    await dataSource.initialize();
    const result = await dataSource.runMigrations({ transaction: 'all' });
    console.log(result.length
      ? `Applied ${result.length} tenant migration(s) to schema ${schemaName}: ${result.map((m) => m.name).join(', ')}`
      : `Tenant schema ${schemaName} is already up to date.`);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Tenant migration failed:', error);
  process.exitCode = 1;
});
