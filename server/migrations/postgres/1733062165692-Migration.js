const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Migration1733062165692 {
    name = 'Migration1733062165692'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meeting" ADD COLUMN "datesonly" boolean NOT NULL DEFAULT FALSE`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meeting" DROP COLUMN "datesonly"`);
    }
}
