import 'dotenv/config';
import { DataSource } from "typeorm";
import { buildApp } from "./app";
import { Project } from "./entities/Project";
import { Environment } from "./entities/Environment";
import { Flag } from "./entities/Flag";
import { FlagEnvironmentConfig } from "./entities/FlagEnvironmentConfig";
import { Segment } from "./entities/Segment";
import { EvaluationEvent } from "./entities/EvaluationEvent";
import { User } from "./entities/User";
import { Organization } from "./entities/Organization";
import { AuditLog } from "./entities/AuditLog";
import { SchedulerService } from "./services/SchedulerService";
import { getRedisClient } from "./utils/redis";

const start = async () => {
    // Fail fast — never fall back to a hardcoded secret in any environment.
    if (!process.env.JWT_SECRET) {
        console.error("[Startup] FATAL: JWT_SECRET environment variable is not set. Refusing to start.");
        process.exit(1);
    }
    const dataSource = new DataSource({
        type: "postgres",
        host: process.env.DB_HOST || "127.0.0.1",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        username: process.env.DB_USER || "postgres",
        password: process.env.DB_PASS || "postgres",
        database: process.env.DB_NAME || "vexil",
        entities: [Project, Environment, Flag, FlagEnvironmentConfig, Segment, EvaluationEvent, User, Organization, AuditLog],
        // Never auto-sync in any environment — use migrations instead.
        // run_start.sh runs `migration:run` before this process starts, so
        // migrationsRun: true here acts as a safety net for direct `node dist/server.js` invocations.
        synchronize: false,
        migrationsRun: true,
        migrations: [require('path').join(__dirname, 'migrations', '*.js')],
        logging: false,
    });

    await dataSource.initialize();

    const redisClient = getRedisClient();

    const scheduler = new SchedulerService(dataSource.getRepository(FlagEnvironmentConfig), redisClient);
    scheduler.start();

    const app = await buildApp(dataSource);

    try {
        const port = parseInt(process.env.PORT || '3000', 10);
        await app.listen({ port, host: '0.0.0.0' });
        console.log(`Vexil API listening on port ${port}`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }

    process.on('SIGTERM', async () => {
        scheduler.stop();
        redisClient.quit();
        await app.close();
    });
};

start();
