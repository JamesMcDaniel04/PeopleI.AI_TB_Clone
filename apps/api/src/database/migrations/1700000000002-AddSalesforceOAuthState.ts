import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSalesforceOAuthState1700000000002 implements MigrationInterface {
  name = 'AddSalesforceOAuthState1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "salesforce_oauth_states" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "state" character varying NOT NULL,
        "environment_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "is_sandbox" boolean NOT NULL DEFAULT true,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_salesforce_oauth_states_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_salesforce_oauth_states_state" UNIQUE ("state")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_salesforce_oauth_states_expires_at" ON "salesforce_oauth_states" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_salesforce_oauth_states_expires_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "salesforce_oauth_states"`);
  }
}
