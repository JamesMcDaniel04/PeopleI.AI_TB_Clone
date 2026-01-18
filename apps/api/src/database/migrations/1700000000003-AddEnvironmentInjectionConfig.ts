import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnvironmentInjectionConfig1700000000003 implements MigrationInterface {
  name = 'AddEnvironmentInjectionConfig1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "environments" ADD "injection_config" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "environments" DROP COLUMN "injection_config"`);
  }
}
