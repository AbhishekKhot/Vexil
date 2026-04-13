import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique } from "typeorm";
import { Flag } from "./Flag";
import { Environment } from "./Environment";

@Entity("flag_environment_configs")
@Unique(["flag", "environment"])
export class FlagEnvironmentConfig {
    @PrimaryGeneratedColumn("uuid") id!: string;
    @ManyToOne(() => Flag, { onDelete: "CASCADE", eager: false }) flag!: Flag;
    @ManyToOne(() => Environment, { onDelete: "CASCADE", eager: false }) environment!: Environment;
    @Column({ default: false }) isEnabled!: boolean;
    @Column({ default: "boolean" }) strategyType!: string;
    @Column({ type: "jsonb", nullable: true }) strategyConfig?: Record<string, unknown>;
    @Column({ type: "timestamp", nullable: true }) scheduledAt?: Date;
    @Column({ type: "jsonb", nullable: true }) scheduledConfig?: Record<string, unknown>;
    @CreateDateColumn() createdAt!: Date;
}
