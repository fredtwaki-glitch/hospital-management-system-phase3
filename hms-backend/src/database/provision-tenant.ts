import { DataSource } from 'typeorm';
import { join } from 'path';
import { TENANT_SCHEMA_ENTITIES } from './tenant-entities';

export async function provisionTenantSchema(
  env: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  },
  schemaName: string,
): Promise<void> {
  if (!/^tenant_[a-z0-9_]+$/.test(schemaName)) {
    throw new Error('Invalid tenant schema name');
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: env.host,
    port: env.port,
    username: env.username,
    password: env.password,
    database: env.database,
    ssl: { rejectUnauthorized: false },

    schema: schemaName,
    extra: {
      options: `-c search_path=${schemaName}`,
    },

    entities: TENANT_SCHEMA_ENTITIES,
    migrations: [
      join(__dirname, 'migrations', 'tenant', '*{.ts,.js}'),
    ],
    migrationsTableName: 'migrations',

    synchronize: false,
  });

  try {
    await dataSource.initialize();

    await dataSource.query(
      `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,
    );

    await dataSource.query(
      `SET search_path TO "${schemaName}"`,
    );

    const executedMigrations = await dataSource.runMigrations();

    console.log(
      `Tenant schema ${schemaName} provisioned successfully.`,
    );
    console.log(
      `Executed ${executedMigrations.length} tenant migration(s).`,
    );
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}