import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DropEvaluationEvents — removes the analytics pipeline tables/indexes.
 *
 * The analytics feature (event ingest + per-flag stats dashboard) was removed.
 * This migration is idempotent (IF EXISTS guards) so it is safe to re-run.
 */
export class DropEvaluationEvents1748131200000 implements MigrationInterface {
    name = 'DropEvaluationEvents1748131200000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_evaluation_events_env_flag"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "evaluation_events"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
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
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_evaluation_events_env_flag"
                ON "evaluation_events" ("environmentId", "flagKey")
        `);
    }
}
