import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a client-generated idempotency key to the two entities scoped
 * for offline support (see SCOPE_Frontend_MPesa_SHA_Offline.md - patient
 * registration + appointment scheduling, NOT billing, which should
 * require connectivity anyway).
 *
 * Nullable + partial unique index (same pattern as staffNumber in
 * migration 1700000000007): a request made while online never sends
 * one, so most rows have NULL here. When the offline frontend queues a
 * write, it generates a UUID client-side and replays it verbatim if
 * the first sync attempt's response is lost (e.g. connection drops
 * after the server processed it but before the client got the reply) -
 * the second attempt with the same key returns the original record
 * instead of creating a duplicate patient/appointment.
 */
export class AddClientRequestIdForOfflineSync1700000000009 implements MigrationInterface {
  name = 'AddClientRequestIdForOfflineSync1700000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "patients" ADD COLUMN "clientRequestId" varchar;`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_patients_client_request_id" ON "patients" ("clientRequestId") WHERE "clientRequestId" IS NOT NULL;`,
    );

    await queryRunner.query(`ALTER TABLE "appointments" ADD COLUMN "clientRequestId" varchar;`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_appointments_client_request_id" ON "appointments" ("clientRequestId") WHERE "clientRequestId" IS NOT NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_appointments_client_request_id";`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "clientRequestId";`);
    await queryRunner.query(`DROP INDEX "idx_patients_client_request_id";`);
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "clientRequestId";`);
  }
}
