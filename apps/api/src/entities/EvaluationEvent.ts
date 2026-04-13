import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("evaluation_events")
export class EvaluationEvent {
    @PrimaryGeneratedColumn("uuid") id!: string;
    @Column() environmentId!: string;
    @Column() flagKey!: string;
    @Column({ default: false }) result!: boolean;
    @Column({ type: "simple-json", nullable: true }) context?: unknown;
    @CreateDateColumn() evaluatedAt!: Date;
}
