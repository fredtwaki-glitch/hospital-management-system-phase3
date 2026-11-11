import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { TENANT_SCHEMA_ENTITIES } from './tenant-entities';

/**
 * Schema-per-tenant connection pooling.
 *
 * Why schema-per-tenant rather than database-per-tenant or a shared table
 * with a tenant_id column:
 *  - Strong data isolation without one DB server connection per client.
 *  - Clean per-client export/delete at contract end (DROP SCHEMA).
 *  - Cheaper to operate than database-per-tenant at scale.
 *
 * Connections are cached per schema so we're not opening a fresh pool
 * on every request.
 */
@Injectable()
export class TenantConnectionManager {
  private readonly logger = new Logger(TenantConnectionManager.name);
  private connections = new Map<string, DataSource>();

  constructor(private config: ConfigService) {}

  async getConnection(schemaName: string): Promise<DataSource> {
    const cached = this.connections.get(schemaName);
    if (cached?.isInitialized) {
      return cached;
    }

    const dataSource = new DataSource({
      type: 'postgres',
      host: this.config.get('TENANT_DB_HOST'),
      port: this.config.get('TENANT_DB_PORT'),
      username: this.config.get('TENANT_DB_USER'),
      password: this.config.get('TENANT_DB_PASSWORD'),
      database: this.config.get('TENANT_DB_NAME'),
      schema: schemaName,
      entities: TENANT_SCHEMA_ENTITIES,
      synchronize: false, // migrations only - never auto-sync in a multi-tenant system
      logging: false,
    });

    await dataSource.initialize();
    this.connections.set(schemaName, dataSource);
    this.logger.log(`Opened connection for tenant schema: ${schemaName}`);
    return dataSource;
  }

  async closeAll(): Promise<void> {
    for (const [schema, ds] of this.connections.entries()) {
      if (ds.isInitialized) {
        await ds.destroy();
        this.logger.log(`Closed connection for tenant schema: ${schema}`);
      }
    }
    this.connections.clear();
  }
}
