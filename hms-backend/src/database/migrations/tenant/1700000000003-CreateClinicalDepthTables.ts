import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClinicalDepthTables1700000000003 implements MigrationInterface {
  name = 'CreateClinicalDepthTables1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Clinical notes ---
    await queryRunner.query(`
      CREATE TYPE "clinical_note_type_enum" AS ENUM ('progress', 'consultation', 'discharge', 'nursing');
    `);
    await queryRunner.query(`
      CREATE TABLE "clinical_notes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" uuid NOT NULL REFERENCES "patients"("id"),
        "authorId" uuid NOT NULL REFERENCES "users"("id"),
        "appointmentId" uuid REFERENCES "appointments"("id"),
        "noteType" "clinical_note_type_enum" NOT NULL,
        "content" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_clinical_notes_patient" ON "clinical_notes" ("patientId");`);

    // --- Lab orders ---
    await queryRunner.query(`
      CREATE TYPE "lab_order_priority_enum" AS ENUM ('routine', 'urgent', 'stat');
    `);
    await queryRunner.query(`
      CREATE TYPE "lab_order_status_enum" AS ENUM ('ordered', 'specimen_collected', 'in_progress', 'completed', 'cancelled');
    `);
    await queryRunner.query(`
      CREATE TABLE "lab_orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" uuid NOT NULL REFERENCES "patients"("id"),
        "orderedByUserId" uuid NOT NULL REFERENCES "users"("id"),
        "appointmentId" uuid REFERENCES "appointments"("id"),
        "testName" varchar NOT NULL,
        "priority" "lab_order_priority_enum" NOT NULL DEFAULT 'routine',
        "status" "lab_order_status_enum" NOT NULL DEFAULT 'ordered',
        "resultSummary" text,
        "resultAttachmentUrl" varchar,
        "completedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_lab_orders_patient" ON "lab_orders" ("patientId");`);

    // --- Prescriptions ---
    await queryRunner.query(`
      CREATE TYPE "prescription_status_enum" AS ENUM ('active', 'completed', 'cancelled');
    `);
    await queryRunner.query(`
      CREATE TABLE "prescriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" uuid NOT NULL REFERENCES "patients"("id"),
        "prescribedByUserId" uuid NOT NULL REFERENCES "users"("id"),
        "appointmentId" uuid REFERENCES "appointments"("id"),
        "medicationName" varchar NOT NULL,
        "dosage" varchar NOT NULL,
        "frequency" varchar NOT NULL,
        "durationDays" int,
        "instructions" text,
        "status" "prescription_status_enum" NOT NULL DEFAULT 'active',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_prescriptions_patient" ON "prescriptions" ("patientId");`);

    // --- Link dispensing back to the originating prescription ---
    await queryRunner.query(`
      ALTER TABLE "stock_movements" ADD COLUMN "prescriptionId" uuid REFERENCES "prescriptions"("id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stock_movements" DROP COLUMN "prescriptionId";`);
    await queryRunner.query(`DROP TABLE "prescriptions";`);
    await queryRunner.query(`DROP TYPE "prescription_status_enum";`);
    await queryRunner.query(`DROP TABLE "lab_orders";`);
    await queryRunner.query(`DROP TYPE "lab_order_status_enum";`);
    await queryRunner.query(`DROP TYPE "lab_order_priority_enum";`);
    await queryRunner.query(`DROP TABLE "clinical_notes";`);
    await queryRunner.query(`DROP TYPE "clinical_note_type_enum";`);
  }
}
