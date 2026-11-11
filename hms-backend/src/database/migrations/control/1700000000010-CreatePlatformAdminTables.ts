import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformAdminTables1700000000010 implements MigrationInterface {
  name = 'CreatePlatformAdminTables1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "platform_admins" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar UNIQUE NOT NULL,
        "passwordHash" varchar NOT NULL,
        "name" varchar NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "platform_audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "platformAdminId" uuid NOT NULL REFERENCES "platform_admins"("id"),
        "action" varchar NOT NULL,
        "targetTenantId" uuid REFERENCES "tenants"("id"),
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_platform_audit_tenant" ON "platform_audit_logs" ("targetTenantId");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "platform_audit_logs";`);
    await queryRunner.query(`DROP TABLE "platform_admins";`);
  }
}
