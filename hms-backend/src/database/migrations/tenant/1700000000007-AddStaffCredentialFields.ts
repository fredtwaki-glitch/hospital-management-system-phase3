import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffCredentialFields1700000000007 implements MigrationInterface {
  name = 'AddStaffCredentialFields1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // staffNumber is added NULLABLE first, deliberately - a tenant
    // provisioned before this migration may already have staff rows,
    // and ADD COLUMN ... NOT NULL UNIQUE would fail against existing
    // data with no value to populate. For a BRAND NEW tenant (no
    // existing users), this is a non-issue in practice. For an
    // upgrade against a live tenant, the safe path is:
    //   1. run this migration (column added, nullable)
    //   2. backfill staffNumber for existing users manually
    //   3. run a follow-up migration to add the NOT NULL constraint
    // The application layer (auth.controller.ts RegisterDto) already
    // requires staffNumber for every NEW registration regardless of
    // what the DB constraint allows.
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "staffNumber" varchar,
        ADD COLUMN "licenseNumber" varchar,
        ADD COLUMN "department" varchar,
        ADD COLUMN "hireDate" date;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_users_staff_number" ON "users" ("staffNumber") WHERE "staffNumber" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_users_staff_number";`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "staffNumber",
        DROP COLUMN "licenseNumber",
        DROP COLUMN "department",
        DROP COLUMN "hireDate";
    `);
  }
}
