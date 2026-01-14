import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobTrackingColumns1700000000001 implements MigrationInterface {
  name = 'AddJobTrackingColumns1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "jobs" ADD "queue_name" character varying`);
    await queryRunner.query(`ALTER TABLE "jobs" ADD "queue_job_id" character varying`);
    await queryRunner.query(`ALTER TABLE "jobs" ADD "progress" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(
      `CREATE INDEX "IDX_jobs_queue" ON "jobs" ("queue_name", "queue_job_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_jobs_queue"`);
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "progress"`);
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "queue_job_id"`);
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "queue_name"`);
  }
}
