import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInsuranceTables1700000000005 implements MigrationInterface {
  name = 'CreateInsuranceTables1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Payers ---
    await queryRunner.query(`
      CREATE TYPE "payer_type_enum" AS ENUM ('national_scheme', 'private_insurer');
    `);
    await queryRunner.query(`
      CREATE TABLE "payers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar UNIQUE NOT NULL,
        "payerType" "payer_type_enum" NOT NULL,
        "contactEmail" varchar,
        "contactPhone" varchar,
        "claimsSubmissionNotes" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // --- Patient insurance covers ---
    await queryRunner.query(`
      CREATE TYPE "cover_category_enum" AS ENUM ('personal', 'corporate', 'national');
    `);
    await queryRunner.query(`
      CREATE TYPE "relationship_to_policyholder_enum" AS ENUM ('self', 'spouse', 'child', 'other_dependent');
    `);
    await queryRunner.query(`
      CREATE TYPE "cover_priority_enum" AS ENUM ('primary', 'secondary');
    `);
    await queryRunner.query(`
      CREATE TYPE "cover_status_enum" AS ENUM ('active', 'expired', 'suspended');
    `);
    await queryRunner.query(`
      CREATE TABLE "patient_insurance_covers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" uuid NOT NULL REFERENCES "patients"("id"),
        "payerId" uuid NOT NULL REFERENCES "payers"("id"),
        "coverCategory" "cover_category_enum" NOT NULL,
        "organizationName" varchar,
        "memberNumber" varchar NOT NULL,
        "relationshipToPolicyholder" "relationship_to_policyholder_enum" NOT NULL DEFAULT 'self',
        "priority" "cover_priority_enum" NOT NULL,
        "status" "cover_status_enum" NOT NULL DEFAULT 'active',
        "validFrom" date,
        "validTo" date,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_covers_patient" ON "patient_insurance_covers" ("patientId");`);
    await queryRunner.query(`CREATE INDEX "idx_covers_payer" ON "patient_insurance_covers" ("payerId");`);

    // --- Invoice coverage/claim columns ---
    await queryRunner.query(`
      CREATE TYPE "claim_status_enum" AS ENUM (
        'not_applicable', 'pending_submission', 'submitted', 'partially_approved', 'approved', 'rejected', 'paid'
      );
    `);
    await queryRunner.query(`
      ALTER TABLE "invoices"
        ADD COLUMN "primaryCoverId" uuid REFERENCES "patient_insurance_covers"("id"),
        ADD COLUMN "secondaryCoverId" uuid REFERENCES "patient_insurance_covers"("id"),
        ADD COLUMN "claimStatus" "claim_status_enum" NOT NULL DEFAULT 'not_applicable',
        ADD COLUMN "payerCoveredAmount" numeric(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN "patientResponsibility" numeric(12,2) NOT NULL DEFAULT 0,
        ADD COLUMN "amountReceivedFromPayer" numeric(12,2) NOT NULL DEFAULT 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
        DROP COLUMN "primaryCoverId",
        DROP COLUMN "secondaryCoverId",
        DROP COLUMN "claimStatus",
        DROP COLUMN "payerCoveredAmount",
        DROP COLUMN "patientResponsibility",
        DROP COLUMN "amountReceivedFromPayer";
    `);
    await queryRunner.query(`DROP TYPE "claim_status_enum";`);
    await queryRunner.query(`DROP TABLE "patient_insurance_covers";`);
    await queryRunner.query(`DROP TYPE "cover_status_enum";`);
    await queryRunner.query(`DROP TYPE "cover_priority_enum";`);
    await queryRunner.query(`DROP TYPE "relationship_to_policyholder_enum";`);
    await queryRunner.query(`DROP TYPE "cover_category_enum";`);
    await queryRunner.query(`DROP TABLE "payers";`);
    await queryRunner.query(`DROP TYPE "payer_type_enum";`);
  }
}
