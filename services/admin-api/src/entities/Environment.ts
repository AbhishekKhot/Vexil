import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique } from "typeorm";
import { Project } from "./Project";

@Entity("environments")
@Unique(["project", "name"])
export class Environment {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string; // e.g., 'dev', 'staging', 'prod'

    @Column({ unique: true })
    apiKey!: string; // Unique string key for SDK

    @ManyToOne(() => Project, (project) => project.environments)
    project!: Project;

    @CreateDateColumn()
    createdAt!: Date;
}
