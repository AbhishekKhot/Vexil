import 'dotenv/config';
import path from 'path';
import { DataSource } from 'typeorm';
import { Project } from './entities/Project';
import { Environment } from './entities/Environment';
import { Flag } from './entities/Flag';
import { FlagEnvironmentConfig } from './entities/FlagEnvironmentConfig';
import { Segment } from './entities/Segment';
import { EvaluationEvent } from './entities/EvaluationEvent';
import { User } from './entities/User';
import { Organization } from './entities/Organization';
import { AuditLog } from './entities/AuditLog';

/**
 * Dedicated DataSource for the TypeORM CLI.
 *
 * Usage:
 *   npm run migration:generate -- src/migrations/MyMigration
 *   npm run migration:run
 *   npm run migration:revert
 *   npm run migration:show
 *
 * Detects whether it is running as TypeScript source (ts-node / CLI) or as
 * compiled JavaScript (production / run_start.sh) and resolves the migrations
 * glob accordingly so the same file works in both contexts.
 */

const isCompiledJs = __filename.endsWith('.js');

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: process.env.DB_NAME || 'vexil',
    entities: [
        Project,
        Environment,
        Flag,
        FlagEnvironmentConfig,
        Segment,
        EvaluationEvent,
        User,
        Organization,
        AuditLog,
    ],
    // CLI (ts-node) resolves *.ts; production (compiled) resolves *.js
    migrations: [
        path.join(__dirname, 'migrations', isCompiledJs ? '*.js' : '*.ts'),
    ],
    synchronize: false,
    migrationsRun: false,
    logging: false,
});

export default AppDataSource;
