import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToOne, JoinColumn } from "typeorm";
import { Flag } from "./Flag";
import { Environment } from "./Environment";
import { Organization } from "./Organization";

@Entity("projects")
export class Project {
    @PrimaryGeneratedColumn("uuid") id!: string;
    @Column() name!: string;
    @Column({ nullable: true }) description?: string;
    @Column({ name: "organization_id", nullable: true }) organizationId!: string;
    @ManyToOne(() => Organization, (o) => o.projects) @JoinColumn({ name: "organization_id" }) organization!: Organization;
    @OneToMany(() => Flag, (f) => f.project) flags!: Flag[];
    @OneToMany(() => Environment, (e) => e.project) environments!: Environment[];
    @CreateDateColumn() createdAt!: Date;
}
