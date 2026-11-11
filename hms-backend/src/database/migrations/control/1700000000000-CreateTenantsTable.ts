import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantsTable1700000000000 implements MigrationInterface {
  name = 'CreateTenantsTable1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "tenant_status_enum" AS ENUM ('active', 'suspended', 'offboarding');
    `);
    await queryRunner.query(`
      CREATE TYPE "tenant_type_enum" AS ENUM ('hospital', 'clinic', 'pharmacy');
    `);
    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug" varchar UNIQUE NOT NULL,
        "name" varchar NOT NULL,
        "type" "tenant_type_enum" NOT NULL,
        "schemaName" varchar UNIQUE NOT NULL,
        "status" "tenant_status_enum" NOT NULL DEFAULT 'active',
        "licensedModules" text NOT NULL DEFAULT 'hms',
        "dataResidencyRegion" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tenants";`);
    await queryRunner.query(`DROP TYPE "tenant_type_enum";`);
    await queryRunner.query(`DROP TYPE "tenant_status_enum";`);
  }
}
