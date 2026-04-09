import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique } from "typeorm";
import { Project } from "./Project";

@Entity("flags")
@Unique(["project", "key"])
export class Flag {
    @PrimaryGeneratedColumn("uuid") id!: string;
    @Column() key!: string;
    @Column({ nullable: true }) description?: string;
    @Column({ default: "boolean" }) type!: string;
    @ManyToOne(() => Project, (p) => p.flags) project!: Project;
    @CreateDateColumn() createdAt!: Date;
}
