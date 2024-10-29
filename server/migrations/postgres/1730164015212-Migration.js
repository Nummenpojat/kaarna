const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Migration1730164015212 {
    name = 'Migration1730164015212'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meeting" ADD COLUMN "allowguests" boolean NOT NULL DEFAULT TRUE`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meeting" DROP COLUMN "slug"`);
    }
}
