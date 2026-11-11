import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientDemographicsFields1700000000006 implements MigrationInterface {
  name = 'AddPatientDemographicsFields1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "citizenship_status_enum" AS ENUM ('citizen', 'non_citizen');
    `);
    await queryRunner.query(`
      CREATE TYPE "identification_type_enum" AS ENUM (
        'national_id', 'passport', 'birth_certificate', 'alien_id', 'refugee_id', 'none'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE "guardian_relationship_enum" AS ENUM ('parent', 'legal_guardian', 'other');
    `);

    await queryRunner.query(`
      ALTER TABLE "patients"
        ADD COLUMN "citizenshipStatus" "citizenship_status_enum",
        ADD COLUMN "nationality" varchar,
        ADD COLUMN "idType" "identification_type_enum" NOT NULL DEFAULT 'none',
        ADD COLUMN "idNumber" varchar,
        ADD COLUMN "isStudent" boolean NOT NULL DEFAULT false,
        ADD COLUMN "institutionName" varchar,
        ADD COLUMN "studentIdNumber" varchar,
        ADD COLUMN "guardianFullName" varchar,
        ADD COLUMN "guardianRelationship" "guardian_relationship_enum",
        ADD COLUMN "guardianPhone" varchar,
        ADD COLUMN "guardianEmail" varchar,
        ADD COLUMN "guardianIdNumber" varchar;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patients"
        DROP COLUMN "citizenshipStatus",
        DROP COLUMN "nationality",
        DROP COLUMN "idType",
        DROP COLUMN "idNumber",
        DROP COLUMN "isStudent",
        DROP COLUMN "institutionName",
        DROP COLUMN "studentIdNumber",
        DROP COLUMN "guardianFullName",
        DROP COLUMN "guardianRelationship",
        DROP COLUMN "guardianPhone",
        DROP COLUMN "guardianEmail",
        DROP COLUMN "guardianIdNumber";
    `);
    await queryRunner.query(`DROP TYPE "guardian_relationship_enum";`);
    await queryRunner.query(`DROP TYPE "identification_type_enum";`);
    await queryRunner.query(`DROP TYPE "citizenship_status_enum";`);
  }
}
