import { DataSource } from "typeorm";
import { buildApp } from "./app";
import { Project } from "./entities/Project";
import { Environment } from "./entities/Environment";
import { Flag } from "./entities/Flag";
import { FlagEnvironmentConfig } from "./entities/FlagEnvironmentConfig";
import { Segment } from "./entities/Segment";
import { EvaluationEvent } from "./entities/EvaluationEvent";

const start = async () => {
    const dataSource = new DataSource({
        type: "postgres",
        host: "localhost",
        port: 5432,
        username: "postgres",
        password: "postgres",
        database: "vexil",
        entities: [Project, Environment, Flag, FlagEnvironmentConfig, Segment, EvaluationEvent],
        synchronize: true, // Auto-create schema for dev
        logging: false,
    });

    await dataSource.initialize();
    
    const app = buildApp(dataSource);

    try {
        await app.listen({ port: 3000, host: '0.0.0.0' });
        console.log("Vexil Admin API listening on port 3000");
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();
