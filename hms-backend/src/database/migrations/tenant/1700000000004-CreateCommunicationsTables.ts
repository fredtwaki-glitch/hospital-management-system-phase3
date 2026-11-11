import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommunicationsTables1700000000004 implements MigrationInterface {
  name = 'CreateCommunicationsTables1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Conversations / Messages (shared across all 3 external channels) ---
    await queryRunner.query(`
      CREATE TYPE "conversation_channel_enum" AS ENUM ('public_inquiry', 'patient_portal', 'supplier');
    `);
    await queryRunner.query(`
      CREATE TYPE "conversation_status_enum" AS ENUM ('open', 'awaiting_human', 'resolved');
    `);
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "channel" "conversation_channel_enum" NOT NULL,
        "status" "conversation_status_enum" NOT NULL DEFAULT 'open',
        "patientId" uuid REFERENCES "patients"("id"),
        "supplierName" varchar,
        "contactEmail" varchar,
        "contactPhone" varchar,
        "subject" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_conversations_channel_status" ON "conversations" ("channel", "status");`);
    await queryRunner.query(`CREATE INDEX "idx_conversations_patient" ON "conversations" ("patientId");`);

    await queryRunner.query(`
      CREATE TYPE "message_sender_type_enum" AS ENUM ('end_user', 'ai', 'staff');
    `);
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "conversationId" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
        "senderType" "message_sender_type_enum" NOT NULL,
        "staffUserId" uuid REFERENCES "users"("id"),
        "content" text NOT NULL,
        "isDraft" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_messages_conversation" ON "messages" ("conversationId");`);

    // --- Org profile (single row, grounds the public-inquiry AI) ---
    await queryRunner.query(`
      CREATE TABLE "org_profile" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "publicPhone" varchar,
        "publicEmail" varchar,
        "address" varchar,
        "openingHours" text,
        "acceptedInsuranceProviders" text NOT NULL DEFAULT '',
        "additionalPublicNotes" text,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // --- Patient portal OTP login ---
    await queryRunner.query(`
      CREATE TABLE "patient_portal_otps" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" uuid NOT NULL REFERENCES "patients"("id"),
        "codeHash" varchar NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "consumedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_patient_otps_patient" ON "patient_portal_otps" ("patientId");`);

    // --- Supplier contacts (for future real send integration) ---
    await queryRunner.query(`
      CREATE TABLE "supplier_contacts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar UNIQUE NOT NULL,
        "contactEmail" varchar,
        "contactPhone" varchar,
        "notes" varchar
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "supplier_contacts";`);
    await queryRunner.query(`DROP TABLE "patient_portal_otps";`);
    await queryRunner.query(`DROP TABLE "org_profile";`);
    await queryRunner.query(`DROP TABLE "messages";`);
    await queryRunner.query(`DROP TYPE "message_sender_type_enum";`);
    await queryRunner.query(`DROP TABLE "conversations";`);
    await queryRunner.query(`DROP TYPE "conversation_status_enum";`);
    await queryRunner.query(`DROP TYPE "conversation_channel_enum";`);
  }
}
