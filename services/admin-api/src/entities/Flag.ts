import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique } from "typeorm";
import { Project } from "./Project";

@Entity("flags")
@Unique(["project", "key"])
export class Flag {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    key!: string; // e.g., 'new-search-v2'

    @Column({ nullable: true })
    description?: string;

    @Column({ default: "boolean" })
    type!: string; // boolean, string, number, json

    @ManyToOne(() => Project, (project) => project.flags)
    project!: Project;

    @CreateDateColumn()
    createdAt!: Date;
}