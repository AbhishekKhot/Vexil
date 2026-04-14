import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * InitialSchema — baseline migration covering all 9 entities.
 *
 * All CREATE TABLE statements use IF NOT EXISTS so this migration is safe to
 * run against an existing database that was previously bootstrapped by
 * TypeORM's synchronize: true.  If all tables already exist, every statement
 * succeeds silently and the migration is recorded as applied.
 *
 * Foreign-key constraints are added with EXCEPTION WHEN duplicate_object so
 * they are likewise idempotent on existing databases.
 *
 * Tables created (in dependency order):
 *   1. organizations
 *   2. users
 *   3. projects
 *   4. environments
 *   5. flags
 *   6. segments
 *   7. flag_environment_configs
 *   8. evaluation_events
 *   9. audit_logs
 */
export class InitialSchema1744588800000 implements MigrationInterface {
    name = 'InitialSchema1744588800000';

    public async up(queryRunner: QueryRunner): Promise<void> {

        // ── Enum types ────────────────────────────────────────────────────────
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."users_role_enum" AS ENUM ('admin', 'member', 'viewer');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$
        `);

        // ── 1. organizations ──────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "organizations" (
                "id"        uuid                        NOT NULL DEFAULT gen_random_uuid(),
                "name"      character varying           NOT NULL,
                "slug"      character varying           NOT NULL,
                "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_organizations_slug" UNIQUE ("slug"),
                CONSTRAINT "PK_organizations"       PRIMARY KEY ("id")
            )
        `);

        // ── 2. users ─────────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "users" (
                "id"              uuid                            NOT NULL DEFAULT gen_random_uuid(),
                "name"            character varying               NOT NULL,
                "email"           character varying               NOT NULL,
                "passwordHash"    character varying               NOT NULL,
                "role"            "public"."users_role_enum"      NOT NULL DEFAULT 'member',
                "organization_id" uuid                            NOT NULL,
                "createdAt"       TIMESTAMP WITHOUT TIME ZONE     NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_users_email" UNIQUE ("email"),
                CONSTRAINT "PK_users"       PRIMARY KEY ("id")
            )
        `);

        // ── 3. projects ───────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "projects" (
                "id"              uuid                        NOT NULL DEFAULT gen_random_uuid(),
                "name"            character varying           NOT NULL,
                "description"     character varying,
                "organization_id" uuid,
                "createdAt"       TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_projects" PRIMARY KEY ("id")
            )
        `);

        // ── 4. environments ───────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "environments" (
                "id"        uuid                        NOT NULL DEFAULT gen_random_uuid(),
                "name"      character varying           NOT NULL,
                "apiKey"    character varying           NOT NULL,
                "projectId" uuid,
                "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_environments_apiKey"        UNIQUE ("apiKey"),
                CONSTRAINT "UQ_environments_project_name"  UNIQUE ("projectId", "name"),
                CONSTRAINT "PK_environments"               PRIMARY KEY ("id")
            )
        `);

        // ── 5. flags ──────────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "flags" (
                "id"          uuid                        NOT NULL DEFAULT gen_random_uuid(),
                "key"         character varying           NOT NULL,
                "description" character varying,
                "type"        character varying           NOT NULL DEFAULT 'boolean',
                "projectId"   uuid,
                "createdAt"   TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_flags_project_key" UNIQUE ("projectId", "key"),
                CONSTRAINT "PK_flags"             PRIMARY KEY ("id")
            )
        `);

        // ── 6. segments ───────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "segments" (
                "id"          uuid                        NOT NULL DEFAULT gen_random_uuid(),
                "name"        character varying           NOT NULL,
                "description" character varying,
                "rules"       text                        NOT NULL,
                "projectId"   uuid,
                "createdAt"   TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_segments_project_name" UNIQUE ("projectId", "name"),
                CONSTRAINT "PK_segments"              PRIMARY KEY ("id")
            )
        `);

        // ── 7. flag_environment_configs ───────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "flag_environment_configs" (
                "id"              uuid                        NOT NULL DEFAULT gen_random_uuid(),
                "isEnabled"       boolean                     NOT NULL DEFAULT false,
                "strategyType"    character varying           NOT NULL DEFAULT 'boolean',
                "strategyConfig"  jsonb,
                "scheduledAt"     TIMESTAMP WITHOUT TIME ZONE,
                "scheduledConfig" jsonb,
                "createdAt"       TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
                "flagId"          uuid,
                "environmentId"   uuid,
                CONSTRAINT "UQ_fec_flag_environment" UNIQUE ("flagId", "environmentId"),
                CONSTRAINT "PK_flag_environment_configs" PRIMARY KEY ("id")
            )
        `);

        // ── 8. evaluation_events ──────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "evaluation_events" (
                "id"            uuid                        NOT NULL DEFAULT gen_random_uuid(),
                "environmentId" character varying           NOT NULL,
                "flagKey"       character varying           NOT NULL,
                "result"        boolean                     NOT NULL DEFAULT false,
                "context"       text,
                "evaluatedAt"   TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_evaluation_events" PRIMARY KEY ("id")
            )
        `);

        // ── 9. audit_logs ─────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "audit_logs" (
                "id"            uuid                        NOT NULL DEFAULT gen_random_uuid(),
                "entityType"    character varying           NOT NULL,
                "entityId"      character varying           NOT NULL,
                "action"        character varying           NOT NULL,
                "actorId"       character varying,
                "actorEmail"    character varying,
                "previousValue" jsonb,
                "newValue"      jsonb,
                "metadata"      jsonb,
                "createdAt"     TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
            )
        `);

        // ── Foreign-key constraints (idempotent) ──────────────────────────────

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "users"
                    ADD CONSTRAINT "FK_users_organization"
                    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
                    ON DELETE NO ACTION ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "projects"
                    ADD CONSTRAINT "FK_projects_organization"
                    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
                    ON DELETE NO ACTION ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "environments"
                    ADD CONSTRAINT "FK_environments_project"
                    FOREIGN KEY ("projectId") REFERENCES "projects"("id")
                    ON DELETE NO ACTION ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "flags"
                    ADD CONSTRAINT "FK_flags_project"
                    FOREIGN KEY ("projectId") REFERENCES "projects"("id")
                    ON DELETE NO ACTION ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "segments"
                    ADD CONSTRAINT "FK_segments_project"
                    FOREIGN KEY ("projectId") REFERENCES "projects"("id")
                    ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "flag_environment_configs"
                    ADD CONSTRAINT "FK_fec_flag"
                    FOREIGN KEY ("flagId") REFERENCES "flags"("id")
                    ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "flag_environment_configs"
                    ADD CONSTRAINT "FK_fec_environment"
                    FOREIGN KEY ("environmentId") REFERENCES "environments"("id")
                    ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);

        // ── Performance indexes ───────────────────────────────────────────────

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_evaluation_events_env_flag"
                ON "evaluation_events" ("environmentId", "flagKey")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entity"
                ON "audit_logs" ("entityType", "entityId")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_entity"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_evaluation_events_env_flag"`);

        // Drop foreign keys
        await queryRunner.query(`ALTER TABLE "flag_environment_configs" DROP CONSTRAINT IF EXISTS "FK_fec_environment"`);
        await queryRunner.query(`ALTER TABLE "flag_environment_configs" DROP CONSTRAINT IF EXISTS "FK_fec_flag"`);
        await queryRunner.query(`ALTER TABLE "segments"                 DROP CONSTRAINT IF EXISTS "FK_segments_project"`);
        await queryRunner.query(`ALTER TABLE "flags"                    DROP CONSTRAINT IF EXISTS "FK_flags_project"`);
        await queryRunner.query(`ALTER TABLE "environments"             DROP CONSTRAINT IF EXISTS "FK_environments_project"`);
        await queryRunner.query(`ALTER TABLE "projects"                 DROP CONSTRAINT IF EXISTS "FK_projects_organization"`);
        await queryRunner.query(`ALTER TABLE "users"                    DROP CONSTRAINT IF EXISTS "FK_users_organization"`);

        // Drop tables in reverse dependency order
        await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "evaluation_events"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "flag_environment_configs"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "segments"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "flags"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "environments"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "projects"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "organizations"`);

        // Drop enum types
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
    }
}
