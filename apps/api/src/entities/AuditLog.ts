import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("audit_logs")
export class AuditLog {
    @PrimaryGeneratedColumn("uuid") id!: string;
    @Column() entityType!: string;
    @Column() entityId!: string;
    @Column() action!: string;
    @Column({ nullable: true }) actorId?: string;
    @Column({ nullable: true }) actorEmail?: string;
    @Column({ type: "jsonb", nullable: true }) previousValue?: Record<string, unknown>;
    @Column({ type: "jsonb", nullable: true }) newValue?: Record<string, unknown>;
    @Column({ type: "jsonb", nullable: true }) metadata?: Record<string, unknown>;
    @CreateDateColumn() createdAt!: Date;
}
