import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Runs against a single tenant's schema (search_path is set by the
 * onboarding script before this executes). Every tenant gets an
 * identical copy of this schema shape.
 */
export class CreateUsersAndAuditLog1700000000001 implements MigrationInterface {
  name = 'CreateUsersAndAuditLog1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM (
        'admin', 'doctor', 'nurse', 'pharmacist', 'billing_staff', 'front_desk'
      );
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar UNIQUE NOT NULL,
        "passwordHash" varchar NOT NULL,
        "firstName" varchar NOT NULL,
        "lastName" varchar NOT NULL,
        "role" "user_role_enum" NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "action" varchar NOT NULL,
        "resourceType" varchar,
        "resourceId" varchar,
        "ipAddress" varchar,
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_user" ON "audit_logs" ("userId");`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" ("resourceType", "resourceId");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs";`);
    await queryRunner.query(`DROP TABLE "users";`);
    await queryRunner.query(`DROP TYPE "user_role_enum";`);
  }
}
