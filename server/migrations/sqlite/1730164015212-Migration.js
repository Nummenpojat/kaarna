const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Migration1730164015212 {
    name = 'Migration1730164015212'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "temporary_Meeting" ("ID" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "Name" varchar NOT NULL, "About" varchar NOT NULL, "Timezone" varchar NOT NULL, "MinStartHour" decimal(4,2) NOT NULL, "MaxEndHour" decimal(4,2) NOT NULL, "TentativeDates" text NOT NULL, "ScheduledStartDateTime" varchar, "ScheduledEndDateTime" varchar, "AllowGuests" boolean NOT NULL DEFAULT (1), "WasScheduledAtLeastOnce" boolean NOT NULL DEFAULT (0), "CreatorID" integer, "Slug" varchar NOT NULL, CONSTRAINT "FK_2c4887a0cd84df13e0378dd457a" FOREIGN KEY ("CreatorID") REFERENCES "User" ("ID") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_Meeting"("ID", "Name", "About", "Timezone", "MinStartHour", "MaxEndHour", "TentativeDates", "ScheduledStartDateTime", "ScheduledEndDateTime", "AllowGuests", "WasScheduledAtLeastOnce", "CreatorID", "Slug") SELECT "ID", "Name", "About", "Timezone", "MinStartHour", "MaxEndHour", "TentativeDates", "ScheduledStartDateTime", "ScheduledEndDateTime", "AllowGuests", "WasScheduledAtLeastOnce", "CreatorID", "Slug" FROM "Meeting"`);
        await queryRunner.query(`DROP TABLE "Meeting"`);
        await queryRunner.query(`ALTER TABLE "temporary_Meeting" RENAME TO "Meeting"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "Meeting" RENAME TO "temporary_Meeting"`);
        await queryRunner.query(`CREATE TABLE "Meeting" ("ID" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "Name" varchar NOT NULL, "About" varchar NOT NULL, "Timezone" varchar NOT NULL, "MinStartHour" decimal(4,2) NOT NULL, "MaxEndHour" decimal(4,2) NOT NULL, "TentativeDates" text NOT NULL, "ScheduledStartDateTime" varchar, "ScheduledEndDateTime" varchar, "AllowGuests" boolean NOT NULL DEFAULT (1), "WasScheduledAtLeastOnce" boolean NOT NULL DEFAULT (0), "CreatorID" integer, "Slug" varchar NOT NULL, CONSTRAINT "FK_2c4887a0cd84df13e0378dd457a" FOREIGN KEY ("CreatorID") REFERENCES "User" ("ID") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "Meeting"("ID", "Name", "About", "Timezone", "MinStartHour", "MaxEndHour", "TentativeDates", "ScheduledStartDateTime", "ScheduledEndDateTime", "AllowGuests", "WasScheduledAtLeastOnce", "CreatorID", "Slug") SELECT "ID", "Name", "About", "Timezone", "MinStartHour", "MaxEndHour", "TentativeDates", "ScheduledStartDateTime", "ScheduledEndDateTime", "AllowGuests", "WasScheduledAtLeastOnce", "CreatorID", "Slug" FROM "temporary_Meeting"`);
        await queryRunner.query(`DROP TABLE "temporary_Meeting"`);
    }
}
