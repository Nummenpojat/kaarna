const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Migration1730164015212 {
    name = 'Migration1730164015212'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE \`Meeting\` ADD COLUMN \`AllowGuests\` boolean NOT NULL DEFAULT 1`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE \`Meeting\` DROP COLUMN \`AllowGuests\``);

    }
}
