import 'dotenv/config';
import { DataSource } from "typeorm";
import { buildApp } from "./app";
import { Project } from "./entities/Project";
import { Environment } from "./entities/Environment";
import { Flag } from "./entities/Flag";
import { FlagEnvironmentConfig } from "./entities/FlagEnvironmentConfig";
import { Segment } from "./entities/Segment";
import { EvaluationEvent } from "./entities/EvaluationEvent";
import { AuditLog } from "./entities/AuditLog";
import { User } from "./entities/User";
import { Organization } from "./entities/Organization";
import { SchedulerService } from "./services/SchedulerService";
import { getRedisClient } from "./utils/redis";

const start = async () => {
    const dataSource = new DataSource({
        type: "postgres",
        host: process.env.DB_HOST || "127.0.0.1",
        port: parseInt(process.env.DB_PORT || "5433", 10),
        username: process.env.DB_USER || "postgres",
        password: process.env.DB_PASS || "postgres",
        database: process.env.DB_NAME || "vexil",
        entities: [Project, Environment, Flag, FlagEnvironmentConfig, Segment, EvaluationEvent, AuditLog, User, Organization],
        synchronize: true, // Auto-create schema for dev
        logging: false,
    });

    await dataSource.initialize();
    
    const redisClient = getRedisClient();

    const scheduler = new SchedulerService(dataSource.getRepository(FlagEnvironmentConfig), redisClient);
    scheduler.start();

    const app = buildApp(dataSource);

    try {
        await app.listen({ port: 3000, host: '0.0.0.0' });
        console.log("Vexil Admin API listening on port 3000");
    } catch (err) {
        console.error(err);
        process.exit(1);
    }

    process.on('SIGTERM', () => {
        scheduler.stop();
        redisClient.quit();
    });
};

start();
