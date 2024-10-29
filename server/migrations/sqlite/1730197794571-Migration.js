const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Migration1730197794571 {
    name = 'Migration1730197794571'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "temporary_ExternalGoogleCalendarEvents" ("MeetingID" integer NOT NULL, "UserID" integer NOT NULL, "Events" text NOT NULL, "PrevTimeMin" varchar NOT NULL, "PrevTimeMax" varchar NOT NULL, "SyncToken" text NOT NULL, PRIMARY KEY ("MeetingID", "UserID"))`);
        await queryRunner.query(`INSERT INTO "temporary_ExternalGoogleCalendarEvents"("MeetingID", "UserID", "Events", "PrevTimeMin", "PrevTimeMax", "SyncToken") SELECT "MeetingID", "UserID", "Events", "PrevTimeMin", "PrevTimeMax", "SyncToken" FROM "ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`DROP TABLE "ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`ALTER TABLE "temporary_ExternalGoogleCalendarEvents" RENAME TO "ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`CREATE INDEX "IDX_09b2b5dfc81bf428c62532bd82" ON "ExternalGoogleCalendarEvents" ("UserID") `);
        await queryRunner.query(`DROP INDEX "IDX_4439f7a11c3b1e8e5d5154da4e"`);
        await queryRunner.query(`CREATE TABLE "temporary_ExternalGoogleOAuth2" ("UserID" integer PRIMARY KEY NOT NULL, "LinkedCalendar" boolean NOT NULL DEFAULT (1), "Sub" varchar NOT NULL, "AccessToken" text NOT NULL, "AccessTokenExpiresAt" integer NOT NULL, "RefreshToken" text NOT NULL)`);
        await queryRunner.query(`INSERT INTO "temporary_ExternalGoogleOAuth2"("UserID", "LinkedCalendar", "Sub", "AccessToken", "AccessTokenExpiresAt", "RefreshToken") SELECT "UserID", "LinkedCalendar", "Sub", "AccessToken", "AccessTokenExpiresAt", "RefreshToken" FROM "ExternalGoogleOAuth2"`);
        await queryRunner.query(`DROP TABLE "ExternalGoogleOAuth2"`);
        await queryRunner.query(`ALTER TABLE "temporary_ExternalGoogleOAuth2" RENAME TO "ExternalGoogleOAuth2"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4439f7a11c3b1e8e5d5154da4e" ON "ExternalGoogleOAuth2" ("Sub") `);
        await queryRunner.query(`DROP INDEX "IDX_85a6f3424e2c93954162d532fc"`);
        await queryRunner.query(`CREATE TABLE "temporary_ExternalGoogleCalendarCreatedEvent" ("RespondentID" integer PRIMARY KEY NOT NULL, "UserID" integer NOT NULL, "CreatedEventID" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "temporary_ExternalGoogleCalendarCreatedEvent"("RespondentID", "UserID", "CreatedEventID") SELECT "RespondentID", "UserID", "CreatedEventID" FROM "ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`DROP TABLE "ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`ALTER TABLE "temporary_ExternalGoogleCalendarCreatedEvent" RENAME TO "ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`CREATE INDEX "IDX_85a6f3424e2c93954162d532fc" ON "ExternalGoogleCalendarCreatedEvent" ("UserID") `);
        await queryRunner.query(`DROP INDEX "IDX_09b2b5dfc81bf428c62532bd82"`);
        await queryRunner.query(`CREATE TABLE "temporary_ExternalGoogleCalendarEvents" ("MeetingID" integer NOT NULL, "UserID" integer NOT NULL, "Events" text NOT NULL, "PrevTimeMin" varchar NOT NULL, "PrevTimeMax" varchar NOT NULL, "SyncToken" text NOT NULL, "meetingID" integer, "googleOAuth2UserID" integer, PRIMARY KEY ("MeetingID", "UserID"))`);
        await queryRunner.query(`INSERT INTO "temporary_ExternalGoogleCalendarEvents"("MeetingID", "UserID", "Events", "PrevTimeMin", "PrevTimeMax", "SyncToken") SELECT "MeetingID", "UserID", "Events", "PrevTimeMin", "PrevTimeMax", "SyncToken" FROM "ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`DROP TABLE "ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`ALTER TABLE "temporary_ExternalGoogleCalendarEvents" RENAME TO "ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`CREATE INDEX "IDX_09b2b5dfc81bf428c62532bd82" ON "ExternalGoogleCalendarEvents" ("UserID") `);
        await queryRunner.query(`DROP INDEX "IDX_4439f7a11c3b1e8e5d5154da4e"`);
        await queryRunner.query(`CREATE TABLE "temporary_ExternalGoogleOAuth2" ("UserID" integer PRIMARY KEY NOT NULL, "LinkedCalendar" boolean NOT NULL DEFAULT (1), "Sub" varchar NOT NULL, "AccessToken" text NOT NULL, "AccessTokenExpiresAt" integer NOT NULL, "RefreshToken" text NOT NULL, "userID" integer)`);
        await queryRunner.query(`INSERT INTO "temporary_ExternalGoogleOAuth2"("UserID", "LinkedCalendar", "Sub", "AccessToken", "AccessTokenExpiresAt", "RefreshToken") SELECT "UserID", "LinkedCalendar", "Sub", "AccessToken", "AccessTokenExpiresAt", "RefreshToken" FROM "ExternalGoogleOAuth2"`);
        await queryRunner.query(`DROP TABLE "ExternalGoogleOAuth2"`);
        await queryRunner.query(`ALTER TABLE "temporary_ExternalGoogleOAuth2" RENAME TO "ExternalGoogleOAuth2"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4439f7a11c3b1e8e5d5154da4e" ON "ExternalGoogleOAuth2" ("Sub") `);
        await queryRunner.query(`DROP INDEX "IDX_85a6f3424e2c93954162d532fc"`);
        await queryRunner.query(`CREATE TABLE "temporary_ExternalGoogleCalendarCreatedEvent" ("RespondentID" integer PRIMARY KEY NOT NULL, "UserID" integer NOT NULL, "CreatedEventID" varchar NOT NULL, "meetingRespondentRespondentID" integer, "googleOAuth2UserID" integer)`);
        await queryRunner.query(`INSERT INTO "temporary_ExternalGoogleCalendarCreatedEvent"("RespondentID", "UserID", "CreatedEventID") SELECT "RespondentID", "UserID", "CreatedEventID" FROM "ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`DROP TABLE "ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`ALTER TABLE "temporary_ExternalGoogleCalendarCreatedEvent" RENAME TO "ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`CREATE INDEX "IDX_85a6f3424e2c93954162d532fc" ON "ExternalGoogleCalendarCreatedEvent" ("UserID") `);
        await queryRunner.query(`DROP INDEX "IDX_09b2b5dfc81bf428c62532bd82"`);
        await queryRunner.query(`CREATE TABLE "temporary_ExternalGoogleCalendarEvents" ("MeetingID" integer NOT NULL, "UserID" integer NOT NULL, "Events" text NOT NULL, "PrevTimeMin" varchar NOT NULL, "PrevTimeMax" varchar NOT NULL, "SyncToken" text NOT NULL, "meetingID" integer, "googleOAuth2UserID" integer, CONSTRAINT "FK_6d7ce227085d9b6f8a4c386cd86" FOREIGN KEY ("meetingID") REFERENCES "Meeting" ("ID") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_26f20a5212ddc77adecf43d0ef5" FOREIGN KEY ("googleOAuth2UserID") REFERENCES "ExternalGoogleOAuth2" ("UserID") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("MeetingID", "UserID"))`);
        await queryRunner.query(`INSERT INTO "temporary_ExternalGoogleCalendarEvents"("MeetingID", "UserID", "Events", "PrevTimeMin", "PrevTimeMax", "SyncToken", "meetingID", "googleOAuth2UserID") SELECT "MeetingID", "UserID", "Events", "PrevTimeMin", "PrevTimeMax", "SyncToken", "meetingID", "googleOAuth2UserID" FROM "ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`DROP TABLE "ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`ALTER TABLE "temporary_ExternalGoogleCalendarEvents" RENAME TO "ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`CREATE INDEX "IDX_09b2b5dfc81bf428c62532bd82" ON "ExternalGoogleCalendarEvents" ("UserID") `);
        await queryRunner.query(`DROP INDEX "IDX_4439f7a11c3b1e8e5d5154da4e"`);
        await queryRunner.query(`CREATE TABLE "temporary_ExternalGoogleOAuth2" ("UserID" integer PRIMARY KEY NOT NULL, "LinkedCalendar" boolean NOT NULL DEFAULT (1), "Sub" varchar NOT NULL, "AccessToken" text NOT NULL, "AccessTokenExpiresAt" integer NOT NULL, "RefreshToken" text NOT NULL, "userID" integer, CONSTRAINT "FK_6b4bd36ead50cc3aff9053a2e49" FOREIGN KEY ("userID") REFERENCES "User" ("ID") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_ExternalGoogleOAuth2"("UserID", "LinkedCalendar", "Sub", "AccessToken", "AccessTokenExpiresAt", "RefreshToken", "userID") SELECT "UserID", "LinkedCalendar", "Sub", "AccessToken", "AccessTokenExpiresAt", "RefreshToken", "userID" FROM "ExternalGoogleOAuth2"`);
        await queryRunner.query(`DROP TABLE "ExternalGoogleOAuth2"`);
        await queryRunner.query(`ALTER TABLE "temporary_ExternalGoogleOAuth2" RENAME TO "ExternalGoogleOAuth2"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4439f7a11c3b1e8e5d5154da4e" ON "ExternalGoogleOAuth2" ("Sub") `);
        await queryRunner.query(`DROP INDEX "IDX_85a6f3424e2c93954162d532fc"`);
        await queryRunner.query(`CREATE TABLE "temporary_ExternalGoogleCalendarCreatedEvent" ("RespondentID" integer PRIMARY KEY NOT NULL, "UserID" integer NOT NULL, "CreatedEventID" varchar NOT NULL, "meetingRespondentRespondentID" integer, "googleOAuth2UserID" integer, CONSTRAINT "FK_51b58033cbe81bd2d082f7d277a" FOREIGN KEY ("meetingRespondentRespondentID") REFERENCES "MeetingRespondent" ("RespondentID") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_86d69b5851694f746f4ae968719" FOREIGN KEY ("googleOAuth2UserID") REFERENCES "ExternalGoogleOAuth2" ("UserID") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_ExternalGoogleCalendarCreatedEvent"("RespondentID", "UserID", "CreatedEventID", "meetingRespondentRespondentID", "googleOAuth2UserID") SELECT "RespondentID", "UserID", "CreatedEventID", "meetingRespondentRespondentID", "googleOAuth2UserID" FROM "ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`DROP TABLE "ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`ALTER TABLE "temporary_ExternalGoogleCalendarCreatedEvent" RENAME TO "ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`CREATE INDEX "IDX_85a6f3424e2c93954162d532fc" ON "ExternalGoogleCalendarCreatedEvent" ("UserID") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "IDX_85a6f3424e2c93954162d532fc"`);
        await queryRunner.query(`ALTER TABLE "ExternalGoogleCalendarCreatedEvent" RENAME TO "temporary_ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`CREATE TABLE "ExternalGoogleCalendarCreatedEvent" ("RespondentID" integer PRIMARY KEY NOT NULL, "UserID" integer NOT NULL, "CreatedEventID" varchar NOT NULL, "meetingRespondentRespondentID" integer, "googleOAuth2UserID" integer)`);
        await queryRunner.query(`INSERT INTO "ExternalGoogleCalendarCreatedEvent"("RespondentID", "UserID", "CreatedEventID", "meetingRespondentRespondentID", "googleOAuth2UserID") SELECT "RespondentID", "UserID", "CreatedEventID", "meetingRespondentRespondentID", "googleOAuth2UserID" FROM "temporary_ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`DROP TABLE "temporary_ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`CREATE INDEX "IDX_85a6f3424e2c93954162d532fc" ON "ExternalGoogleCalendarCreatedEvent" ("UserID") `);
        await queryRunner.query(`DROP INDEX "IDX_4439f7a11c3b1e8e5d5154da4e"`);
        await queryRunner.query(`ALTER TABLE "ExternalGoogleOAuth2" RENAME TO "temporary_ExternalGoogleOAuth2"`);
        await queryRunner.query(`CREATE TABLE "ExternalGoogleOAuth2" ("UserID" integer PRIMARY KEY NOT NULL, "LinkedCalendar" boolean NOT NULL DEFAULT (1), "Sub" varchar NOT NULL, "AccessToken" text NOT NULL, "AccessTokenExpiresAt" integer NOT NULL, "RefreshToken" text NOT NULL, "userID" integer)`);
        await queryRunner.query(`INSERT INTO "ExternalGoogleOAuth2"("UserID", "LinkedCalendar", "Sub", "AccessToken", "AccessTokenExpiresAt", "RefreshToken", "userID") SELECT "UserID", "LinkedCalendar", "Sub", "AccessToken", "AccessTokenExpiresAt", "RefreshToken", "userID" FROM "temporary_ExternalGoogleOAuth2"`);
        await queryRunner.query(`DROP TABLE "temporary_ExternalGoogleOAuth2"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4439f7a11c3b1e8e5d5154da4e" ON "ExternalGoogleOAuth2" ("Sub") `);
        await queryRunner.query(`DROP INDEX "IDX_09b2b5dfc81bf428c62532bd82"`);
        await queryRunner.query(`ALTER TABLE "ExternalGoogleCalendarEvents" RENAME TO "temporary_ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`CREATE TABLE "ExternalGoogleCalendarEvents" ("MeetingID" integer NOT NULL, "UserID" integer NOT NULL, "Events" text NOT NULL, "PrevTimeMin" varchar NOT NULL, "PrevTimeMax" varchar NOT NULL, "SyncToken" text NOT NULL, "meetingID" integer, "googleOAuth2UserID" integer, PRIMARY KEY ("MeetingID", "UserID"))`);
        await queryRunner.query(`INSERT INTO "ExternalGoogleCalendarEvents"("MeetingID", "UserID", "Events", "PrevTimeMin", "PrevTimeMax", "SyncToken", "meetingID", "googleOAuth2UserID") SELECT "MeetingID", "UserID", "Events", "PrevTimeMin", "PrevTimeMax", "SyncToken", "meetingID", "googleOAuth2UserID" FROM "temporary_ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`DROP TABLE "temporary_ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`CREATE INDEX "IDX_09b2b5dfc81bf428c62532bd82" ON "ExternalGoogleCalendarEvents" ("UserID") `);
        await queryRunner.query(`DROP INDEX "IDX_85a6f3424e2c93954162d532fc"`);
        await queryRunner.query(`ALTER TABLE "ExternalGoogleCalendarCreatedEvent" RENAME TO "temporary_ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`CREATE TABLE "ExternalGoogleCalendarCreatedEvent" ("RespondentID" integer PRIMARY KEY NOT NULL, "UserID" integer NOT NULL, "CreatedEventID" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "ExternalGoogleCalendarCreatedEvent"("RespondentID", "UserID", "CreatedEventID") SELECT "RespondentID", "UserID", "CreatedEventID" FROM "temporary_ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`DROP TABLE "temporary_ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`CREATE INDEX "IDX_85a6f3424e2c93954162d532fc" ON "ExternalGoogleCalendarCreatedEvent" ("UserID") `);
        await queryRunner.query(`DROP INDEX "IDX_4439f7a11c3b1e8e5d5154da4e"`);
        await queryRunner.query(`ALTER TABLE "ExternalGoogleOAuth2" RENAME TO "temporary_ExternalGoogleOAuth2"`);
        await queryRunner.query(`CREATE TABLE "ExternalGoogleOAuth2" ("UserID" integer PRIMARY KEY NOT NULL, "LinkedCalendar" boolean NOT NULL DEFAULT (1), "Sub" varchar NOT NULL, "AccessToken" text NOT NULL, "AccessTokenExpiresAt" integer NOT NULL, "RefreshToken" text NOT NULL)`);
        await queryRunner.query(`INSERT INTO "ExternalGoogleOAuth2"("UserID", "LinkedCalendar", "Sub", "AccessToken", "AccessTokenExpiresAt", "RefreshToken") SELECT "UserID", "LinkedCalendar", "Sub", "AccessToken", "AccessTokenExpiresAt", "RefreshToken" FROM "temporary_ExternalGoogleOAuth2"`);
        await queryRunner.query(`DROP TABLE "temporary_ExternalGoogleOAuth2"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4439f7a11c3b1e8e5d5154da4e" ON "ExternalGoogleOAuth2" ("Sub") `);
        await queryRunner.query(`DROP INDEX "IDX_09b2b5dfc81bf428c62532bd82"`);
        await queryRunner.query(`ALTER TABLE "ExternalGoogleCalendarEvents" RENAME TO "temporary_ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`CREATE TABLE "ExternalGoogleCalendarEvents" ("MeetingID" integer NOT NULL, "UserID" integer NOT NULL, "Events" text NOT NULL, "PrevTimeMin" varchar NOT NULL, "PrevTimeMax" varchar NOT NULL, "SyncToken" text NOT NULL, PRIMARY KEY ("MeetingID", "UserID"))`);
        await queryRunner.query(`INSERT INTO "ExternalGoogleCalendarEvents"("MeetingID", "UserID", "Events", "PrevTimeMin", "PrevTimeMax", "SyncToken") SELECT "MeetingID", "UserID", "Events", "PrevTimeMin", "PrevTimeMax", "SyncToken" FROM "temporary_ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`DROP TABLE "temporary_ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`CREATE INDEX "IDX_09b2b5dfc81bf428c62532bd82" ON "ExternalGoogleCalendarEvents" ("UserID") `);
        await queryRunner.query(`DROP INDEX "IDX_85a6f3424e2c93954162d532fc"`);
        await queryRunner.query(`ALTER TABLE "ExternalGoogleCalendarCreatedEvent" RENAME TO "temporary_ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`CREATE TABLE "ExternalGoogleCalendarCreatedEvent" ("RespondentID" integer PRIMARY KEY NOT NULL, "UserID" integer NOT NULL, "CreatedEventID" varchar NOT NULL, CONSTRAINT "FK_85a6f3424e2c93954162d532fce" FOREIGN KEY ("UserID") REFERENCES "ExternalGoogleOAuth2" ("UserID") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b85da83220062cd6bc11fa60dbc" FOREIGN KEY ("RespondentID") REFERENCES "MeetingRespondent" ("RespondentID") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "ExternalGoogleCalendarCreatedEvent"("RespondentID", "UserID", "CreatedEventID") SELECT "RespondentID", "UserID", "CreatedEventID" FROM "temporary_ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`DROP TABLE "temporary_ExternalGoogleCalendarCreatedEvent"`);
        await queryRunner.query(`CREATE INDEX "IDX_85a6f3424e2c93954162d532fc" ON "ExternalGoogleCalendarCreatedEvent" ("UserID") `);
        await queryRunner.query(`DROP INDEX "IDX_4439f7a11c3b1e8e5d5154da4e"`);
        await queryRunner.query(`ALTER TABLE "ExternalGoogleOAuth2" RENAME TO "temporary_ExternalGoogleOAuth2"`);
        await queryRunner.query(`CREATE TABLE "ExternalGoogleOAuth2" ("UserID" integer PRIMARY KEY NOT NULL, "LinkedCalendar" boolean NOT NULL DEFAULT (1), "Sub" varchar NOT NULL, "AccessToken" text NOT NULL, "AccessTokenExpiresAt" integer NOT NULL, "RefreshToken" text NOT NULL, CONSTRAINT "FK_561aa41b67a61f3c3a39b67cb84" FOREIGN KEY ("UserID") REFERENCES "User" ("ID") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "ExternalGoogleOAuth2"("UserID", "LinkedCalendar", "Sub", "AccessToken", "AccessTokenExpiresAt", "RefreshToken") SELECT "UserID", "LinkedCalendar", "Sub", "AccessToken", "AccessTokenExpiresAt", "RefreshToken" FROM "temporary_ExternalGoogleOAuth2"`);
        await queryRunner.query(`DROP TABLE "temporary_ExternalGoogleOAuth2"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4439f7a11c3b1e8e5d5154da4e" ON "ExternalGoogleOAuth2" ("Sub") `);
        await queryRunner.query(`DROP INDEX "IDX_09b2b5dfc81bf428c62532bd82"`);
        await queryRunner.query(`ALTER TABLE "ExternalGoogleCalendarEvents" RENAME TO "temporary_ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`CREATE TABLE "ExternalGoogleCalendarEvents" ("MeetingID" integer NOT NULL, "UserID" integer NOT NULL, "Events" text NOT NULL, "PrevTimeMin" varchar NOT NULL, "PrevTimeMax" varchar NOT NULL, "SyncToken" text NOT NULL, CONSTRAINT "FK_09b2b5dfc81bf428c62532bd825" FOREIGN KEY ("UserID") REFERENCES "ExternalGoogleOAuth2" ("UserID") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9c21614902a7564cbb82e7e57ec" FOREIGN KEY ("MeetingID") REFERENCES "Meeting" ("ID") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("MeetingID", "UserID"))`);
        await queryRunner.query(`INSERT INTO "ExternalGoogleCalendarEvents"("MeetingID", "UserID", "Events", "PrevTimeMin", "PrevTimeMax", "SyncToken") SELECT "MeetingID", "UserID", "Events", "PrevTimeMin", "PrevTimeMax", "SyncToken" FROM "temporary_ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`DROP TABLE "temporary_ExternalGoogleCalendarEvents"`);
        await queryRunner.query(`CREATE INDEX "IDX_09b2b5dfc81bf428c62532bd82" ON "ExternalGoogleCalendarEvents" ("UserID") `);
    }
}