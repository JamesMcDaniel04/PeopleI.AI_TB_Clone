import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`CREATE TYPE "users_role_enum" AS ENUM ('user', 'admin')`);
    await queryRunner.query(
      `CREATE TYPE "environments_status_enum" AS ENUM ('disconnected', 'connecting', 'connected', 'error')`,
    );
    await queryRunner.query(
      `CREATE TYPE "templates_category_enum" AS ENUM ('sales_scenario', 'industry_vertical', 'custom')`,
    );
    await queryRunner.query(
      `CREATE TYPE "templates_industry_enum" AS ENUM ('technology', 'healthcare', 'finance', 'manufacturing', 'retail', 'general')`,
    );
    await queryRunner.query(
      `CREATE TYPE "template_prompts_salesforce_object_enum" AS ENUM ('Account', 'Contact', 'Opportunity', 'Task', 'Event', 'EmailMessage')`,
    );
    await queryRunner.query(
      `CREATE TYPE "datasets_status_enum" AS ENUM ('pending', 'generating', 'generated', 'injecting', 'completed', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "dataset_records_status_enum" AS ENUM ('generated', 'injecting', 'injected', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "jobs_type_enum" AS ENUM ('data_generation', 'data_injection', 'cleanup')`,
    );
    await queryRunner.query(
      `CREATE TYPE "jobs_status_enum" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "first_name" character varying,
        "last_name" character varying,
        "role" "users_role_enum" NOT NULL DEFAULT 'user',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "environments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "salesforce_instance_url" character varying,
        "salesforce_org_id" character varying,
        "is_sandbox" boolean NOT NULL DEFAULT true,
        "status" "environments_status_enum" NOT NULL DEFAULT 'disconnected',
        "last_synced_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_environments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_environments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "salesforce_credentials" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "environment_id" uuid NOT NULL,
        "access_token_encrypted" text NOT NULL,
        "refresh_token_encrypted" text NOT NULL,
        "token_expires_at" TIMESTAMPTZ,
        "connected_user_email" character varying,
        "connected_user_id" character varying,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_salesforce_credentials_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_salesforce_credentials_environment_id" UNIQUE ("environment_id"),
        CONSTRAINT "FK_salesforce_credentials_environment" FOREIGN KEY ("environment_id") REFERENCES "environments"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" character varying,
        "category" "templates_category_enum" NOT NULL DEFAULT 'sales_scenario',
        "industry" "templates_industry_enum" NOT NULL DEFAULT 'general',
        "is_system" boolean NOT NULL DEFAULT false,
        "user_id" uuid,
        "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_templates_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_templates_user" FOREIGN KEY ("user_id") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "template_prompts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "template_id" uuid NOT NULL,
        "salesforce_object" "template_prompts_salesforce_object_enum" NOT NULL,
        "system_prompt" text NOT NULL,
        "user_prompt_template" text NOT NULL,
        "output_schema" jsonb,
        "temperature" numeric(3,2) NOT NULL DEFAULT 0.7,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_template_prompts_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_template_prompts_template" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "datasets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "environment_id" uuid,
        "template_id" uuid,
        "name" character varying NOT NULL,
        "description" character varying,
        "status" "datasets_status_enum" NOT NULL DEFAULT 'pending',
        "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "record_counts" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "error_message" character varying,
        "started_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_datasets_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_datasets_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_datasets_environment" FOREIGN KEY ("environment_id") REFERENCES "environments"("id"),
        CONSTRAINT "FK_datasets_template" FOREIGN KEY ("template_id") REFERENCES "templates"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "dataset_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "dataset_id" uuid NOT NULL,
        "salesforce_object" character varying NOT NULL,
        "local_id" character varying NOT NULL,
        "salesforce_id" character varying(18),
        "data" jsonb NOT NULL,
        "status" "dataset_records_status_enum" NOT NULL DEFAULT 'generated',
        "parent_local_id" character varying,
        "error_message" character varying,
        "injected_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dataset_records_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dataset_records_dataset" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_dataset_records_dataset_object" ON "dataset_records" ("dataset_id", "salesforce_object")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_dataset_records_local_id" ON "dataset_records" ("local_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "jobs_type_enum" NOT NULL,
        "status" "jobs_status_enum" NOT NULL DEFAULT 'pending',
        "user_id" uuid,
        "dataset_id" uuid,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "result" jsonb,
        "error_message" character varying,
        "attempts" integer NOT NULL DEFAULT 0,
        "max_attempts" integer NOT NULL DEFAULT 3,
        "priority" integer NOT NULL DEFAULT 0,
        "scheduled_for" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "started_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_jobs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_jobs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
        CONSTRAINT "FK_jobs_dataset" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_jobs_status_scheduled_for" ON "jobs" ("status", "scheduled_for")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_jobs_type_status" ON "jobs" ("type", "status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_jobs_type_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_jobs_status_scheduled_for"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jobs"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dataset_records_local_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_dataset_records_dataset_object"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dataset_records"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "datasets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "template_prompts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "templates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "salesforce_credentials"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "environments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "jobs_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "jobs_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "dataset_records_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "datasets_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "template_prompts_salesforce_object_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "templates_industry_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "templates_category_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "environments_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);

    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
  }
}
