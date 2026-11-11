import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 3: durable event delivery queue and auditable staff shift lifecycle. */
export class CreateIntegrationOutboxAndStaffShifts1700000000010 implements MigrationInterface {
  name = 'CreateIntegrationOutboxAndStaffShifts1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "event_outbox_status_enum" AS ENUM ('pending', 'processing', 'retry', 'delivered', 'failed');
    `);
    await queryRunner.query(`
      CREATE TABLE "event_outbox" (
        "eventId" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" varchar NOT NULL,
        "eventType" varchar NOT NULL,
        "eventVersion" int NOT NULL DEFAULT 1,
        "payload" jsonb NOT NULL,
        "status" "event_outbox_status_enum" NOT NULL DEFAULT 'pending',
        "attemptCount" int NOT NULL DEFAULT 0,
        "availableAt" timestamptz NOT NULL DEFAULT now(),
        "lockedAt" timestamptz,
        "deliveredAt" timestamptz,
        "lastError" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_event_outbox_dispatch" ON "event_outbox" ("status", "availableAt", "createdAt");`);
    await queryRunner.query(`CREATE INDEX "idx_event_outbox_tenant_type" ON "event_outbox" ("tenantId", "eventType");`);

    await queryRunner.query(`
      CREATE TYPE "staff_shift_status_enum" AS ENUM ('in_progress', 'completed');
    `);
    await queryRunner.query(`
      CREATE TABLE "staff_shifts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "staffId" uuid NOT NULL REFERENCES "users"("id"),
        "staffNumber" varchar NOT NULL,
        "startedAt" timestamptz NOT NULL,
        "endedAt" timestamptz,
        "status" "staff_shift_status_enum" NOT NULL DEFAULT 'in_progress',
        "breakMinutes" int NOT NULL DEFAULT 0 CHECK ("breakMinutes" >= 0 AND "breakMinutes" <= 1440),
        "minutesWorked" int,
        "notes" text,
        "createdByUserId" uuid NOT NULL REFERENCES "users"("id"),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_staff_shift_time" CHECK ("endedAt" IS NULL OR "endedAt" > "startedAt")
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_staff_shifts_staff_started" ON "staff_shifts" ("staffId", "startedAt");`);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_staff_shifts_one_active_per_staff" ON "staff_shifts" ("staffId") WHERE "status" = 'in_progress';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "staff_shifts";`);
    await queryRunner.query(`DROP TYPE "staff_shift_status_enum";`);
    await queryRunner.query(`DROP TABLE "event_outbox";`);
    await queryRunner.query(`DROP TYPE "event_outbox_status_enum";`);
  }
}
