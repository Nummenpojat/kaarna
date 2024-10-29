const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Migration1730197794571 {
    name = 'Migration1730197794571'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "externalgooglecalendarcreatedevent" ("respondentid" integer NOT NULL, "userid" integer NOT NULL, "createdeventid" character varying NOT NULL, CONSTRAINT "pk_391b9705eb024e5c282fa4de2df2" PRIMARY KEY ("respondentid"))`);
        await queryRunner.query(`CREATE INDEX "idx_8649dc9c4d688c8930e530a5972" ON "externalgooglecalendarcreatedevent" ("userid") `);
        await queryRunner.query(`CREATE TABLE "externalgooglecalendarevents" ("meetingid" integer NOT NULL, "userid" integer NOT NULL, "events" text NOT NULL, "prevtimemin" character varying NOT NULL, "prevtimemax" character varying NOT NULL, "synctoken" text NOT NULL, CONSTRAINT "pk_caefbd55ee650eaf675f6df155c2" PRIMARY KEY ("meetingid", "userid"))`);
        await queryRunner.query(`CREATE INDEX "idx_d52cf21cfd1013cd8fa9051b9d2" ON "externalgooglecalendarevents" ("userid") `);
        await queryRunner.query(`CREATE TABLE "externalgoogleoauth2" ("userid" integer NOT NULL, "linkedcalendar" boolean NOT NULL DEFAULT true, "sub" character varying NOT NULL, "accesstoken" text NOT NULL, "accesstokenexpiresat" integer NOT NULL, "refreshtoken" text NOT NULL, CONSTRAINT "pk_1a86f18707b5586daa9fe2eb6242" PRIMARY KEY ("userid"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_340f49fccfc9183f0d58f434082" ON "externalgoogleoauth2" ("sub") `);
        await queryRunner.query(`ALTER TABLE "externalgooglecalendarcreatedevent" ADD CONSTRAINT "fk_391b9705eb024e5c282fa4de2df2" FOREIGN KEY ("respondentid") REFERENCES "meetingrespondent"("respondentid") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "externalgooglecalendarcreatedevent" ADD CONSTRAINT "fk_8649dc9c4d688c8930e530a597b2" FOREIGN KEY ("userid") REFERENCES "googleoauth2"("userid") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "externalgooglecalendarevents" ADD CONSTRAINT "fk_01af9ceb170c73f93847abe975d2" FOREIGN KEY ("meetingid") REFERENCES "meeting"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "externalgooglecalendarevents" ADD CONSTRAINT "fk_d52cf21cfd1013cd8fa9051b9d32" FOREIGN KEY ("userid") REFERENCES "googleoauth2"("userid") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "externalgoogleoauth2" ADD CONSTRAINT "fk_1a86f18707b5586daa9fe2eb6242" FOREIGN KEY ("userid") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "externalgoogleoauth2" DROP CONSTRAINT "fk_1a86f18707b5586daa9fe2eb6242"`);
        await queryRunner.query(`ALTER TABLE "externalgooglecalendarevents" DROP CONSTRAINT "fk_d52cf21cfd1013cd8fa9051b9d32"`);
        await queryRunner.query(`ALTER TABLE "externalgooglecalendarevents" DROP CONSTRAINT "fk_01af9ceb170c73f93847abe975d2"`);
        await queryRunner.query(`ALTER TABLE "externalgooglecalendarcreatedevent" DROP CONSTRAINT "fk_8649dc9c4d688c8930e530a597b2"`);
        await queryRunner.query(`ALTER TABLE "externalgooglecalendarcreatedevent" DROP CONSTRAINT "fk_391b9705eb024e5c282fa4de2df2"`);
        await queryRunner.query(`DROP TABLE "externalgoogleoauth2"`);
        await queryRunner.query(`DROP INDEX "public"."idx_d52cf21cfd1013cd8fa9051b9d2"`);
        await queryRunner.query(`DROP TABLE "externalgooglecalendarevents"`);
        await queryRunner.query(`DROP INDEX "public"."idx_8649dc9c4d688c8930e530a5972"`);
        await queryRunner.query(`DROP TABLE "externalgooglecalendarcreatedevent"`);
        await queryRunner.query(`DROP INDEX "public"."idx_340f49fccfc9183f0d58f434082"`);
    }
}
