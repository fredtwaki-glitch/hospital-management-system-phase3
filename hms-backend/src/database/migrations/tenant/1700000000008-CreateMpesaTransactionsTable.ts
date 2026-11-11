import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMpesaTransactionsTable1700000000008 implements MigrationInterface {
  name = 'CreateMpesaTransactionsTable1700000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "mpesa_transaction_type_enum" AS ENUM ('stk_push', 'c2b');
    `);
    await queryRunner.query(`
      CREATE TYPE "mpesa_transaction_status_enum" AS ENUM ('initiated', 'completed', 'failed', 'cancelled');
    `);
    await queryRunner.query(`
      CREATE TABLE "mpesa_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoiceId" uuid REFERENCES "invoices"("id"),
        "transactionType" "mpesa_transaction_type_enum" NOT NULL,
        "status" "mpesa_transaction_status_enum" NOT NULL DEFAULT 'initiated',
        "checkoutRequestId" varchar,
        "merchantRequestId" varchar,
        "mpesaReceiptNumber" varchar,
        "phoneNumber" varchar,
        "amount" numeric(12,2) NOT NULL,
        "resultDescription" varchar,
        "rawCallbackPayload" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_mpesa_invoice" ON "mpesa_transactions" ("invoiceId");`);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_mpesa_checkout_request" ON "mpesa_transactions" ("checkoutRequestId") WHERE "checkoutRequestId" IS NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "mpesa_transactions";`);
    await queryRunner.query(`DROP TYPE "mpesa_transaction_status_enum";`);
    await queryRunner.query(`DROP TYPE "mpesa_transaction_type_enum";`);
  }
}
