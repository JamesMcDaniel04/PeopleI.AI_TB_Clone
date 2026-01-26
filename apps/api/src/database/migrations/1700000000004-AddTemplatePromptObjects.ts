import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTemplatePromptObjects1700000000004 implements MigrationInterface {
  name = 'AddTemplatePromptObjects1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "template_prompts_salesforce_object_enum" ADD VALUE IF NOT EXISTS 'Lead'`,
    );
    await queryRunner.query(
      `ALTER TYPE "template_prompts_salesforce_object_enum" ADD VALUE IF NOT EXISTS 'Case'`,
    );
    await queryRunner.query(
      `ALTER TYPE "template_prompts_salesforce_object_enum" ADD VALUE IF NOT EXISTS 'Campaign'`,
    );
    await queryRunner.query(
      `ALTER TYPE "template_prompts_salesforce_object_enum" ADD VALUE IF NOT EXISTS 'CampaignMember'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "template_prompts_salesforce_object_enum" RENAME TO "template_prompts_salesforce_object_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "template_prompts_salesforce_object_enum" AS ENUM ('Account', 'Contact', 'Opportunity', 'Task', 'Event', 'EmailMessage')`,
    );
    await queryRunner.query(
      `ALTER TABLE "template_prompts" ALTER COLUMN "salesforce_object" TYPE "template_prompts_salesforce_object_enum" USING "salesforce_object"::text::"template_prompts_salesforce_object_enum"`,
    );
    await queryRunner.query(`DROP TYPE "template_prompts_salesforce_object_enum_old"`);
  }
}
