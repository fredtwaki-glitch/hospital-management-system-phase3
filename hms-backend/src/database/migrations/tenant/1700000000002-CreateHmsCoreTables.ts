import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHmsCoreTables1700000000002 implements MigrationInterface {
  name = 'CreateHmsCoreTables1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Patients ---
    await queryRunner.query(`
      CREATE TYPE "gender_enum" AS ENUM ('male', 'female', 'other', 'unspecified');
    `);
    await queryRunner.query(`
      CREATE TABLE "patients" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "mrn" varchar UNIQUE NOT NULL,
        "firstName" varchar NOT NULL,
        "lastName" varchar NOT NULL,
        "dateOfBirth" date NOT NULL,
        "gender" "gender_enum" NOT NULL DEFAULT 'unspecified',
        "phone" varchar,
        "email" varchar,
        "address" varchar,
        "emergencyContactName" varchar,
        "emergencyContactPhone" varchar,
        "bloodType" varchar,
        "allergies" text NOT NULL DEFAULT '',
        "isDeceased" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_patients_name" ON "patients" ("lastName", "firstName");`);

    // --- Appointments ---
    await queryRunner.query(`
      CREATE TYPE "appointment_status_enum" AS ENUM (
        'scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'
      );
    `);
    await queryRunner.query(`
      CREATE TABLE "appointments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" uuid NOT NULL REFERENCES "patients"("id"),
        "providerId" uuid NOT NULL REFERENCES "users"("id"),
        "scheduledAt" timestamptz NOT NULL,
        "durationMinutes" int NOT NULL DEFAULT 30,
        "status" "appointment_status_enum" NOT NULL DEFAULT 'scheduled',
        "reason" varchar,
        "notes" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_appointments_patient" ON "appointments" ("patientId");`);
    await queryRunner.query(`CREATE INDEX "idx_appointments_provider_time" ON "appointments" ("providerId", "scheduledAt");`);

    // --- Billing ---
    await queryRunner.query(`
      CREATE TYPE "invoice_status_enum" AS ENUM ('draft', 'issued', 'partially_paid', 'paid', 'void');
    `);
    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" uuid NOT NULL REFERENCES "patients"("id"),
        "appointmentId" uuid REFERENCES "appointments"("id"),
        "status" "invoice_status_enum" NOT NULL DEFAULT 'draft',
        "totalAmount" numeric(12,2) NOT NULL DEFAULT 0,
        "amountPaid" numeric(12,2) NOT NULL DEFAULT 0,
        "currency" varchar NOT NULL DEFAULT 'KES',
        "issuedAt" timestamptz,
        "dueAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_invoices_patient" ON "invoices" ("patientId");`);

    await queryRunner.query(`
      CREATE TABLE "invoice_line_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoiceId" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
        "description" varchar NOT NULL,
        "quantity" int NOT NULL DEFAULT 1,
        "unitPrice" numeric(12,2) NOT NULL,
        "sourceType" varchar,
        "sourceId" varchar
      );
    `);

    // --- Pharmacy ---
    await queryRunner.query(`
      CREATE TABLE "pharmacy_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sku" varchar UNIQUE NOT NULL,
        "name" varchar NOT NULL,
        "category" varchar,
        "unit" varchar NOT NULL DEFAULT 'unit',
        "quantityOnHand" int NOT NULL DEFAULT 0,
        "reorderThreshold" int NOT NULL DEFAULT 10,
        "unitPrice" numeric(12,2) NOT NULL DEFAULT 0,
        "expiryDate" date,
        "supplier" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "stock_movement_type_enum" AS ENUM ('received', 'dispensed', 'adjusted');
    `);
    await queryRunner.query(`
      CREATE TABLE "stock_movements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "itemId" uuid NOT NULL REFERENCES "pharmacy_items"("id"),
        "type" "stock_movement_type_enum" NOT NULL,
        "quantityChange" int NOT NULL,
        "patientId" uuid REFERENCES "patients"("id"),
        "note" varchar,
        "recordedByUserId" uuid NOT NULL REFERENCES "users"("id"),
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_stock_movements_item" ON "stock_movements" ("itemId");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "stock_movements";`);
    await queryRunner.query(`DROP TYPE "stock_movement_type_enum";`);
    await queryRunner.query(`DROP TABLE "pharmacy_items";`);
    await queryRunner.query(`DROP TABLE "invoice_line_items";`);
    await queryRunner.query(`DROP TABLE "invoices";`);
    await queryRunner.query(`DROP TYPE "invoice_status_enum";`);
    await queryRunner.query(`DROP TABLE "appointments";`);
    await queryRunner.query(`DROP TYPE "appointment_status_enum";`);
    await queryRunner.query(`DROP TABLE "patients";`);
    await queryRunner.query(`DROP TYPE "gender_enum";`);
  }
}
