import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Unique } from "typeorm";
import { Project } from "./Project";

@Entity("environments")
@Unique(["project", "name"])
export class Environment {
    @PrimaryGeneratedColumn("uuid") id!: string;
    @Column() name!: string;
    @Column({ unique: true }) apiKey!: string;
    @ManyToOne(() => Project, (p) => p.environments) project!: Project;
    @CreateDateColumn() createdAt!: Date;
}
