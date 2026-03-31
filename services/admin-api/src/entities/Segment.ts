import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique } from "typeorm";
import { Project } from "./Project";

@Entity("segments")
@Unique(["project", "name"])
export class Segment {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string;

    @Column({ nullable: true })
    description?: string;

    @Column({ type: "simple-json" })
    rules!: any; // Array of conditions

    @ManyToOne(() => Project, { onDelete: "CASCADE" })
    project!: Project;

    @CreateDateColumn()
    createdAt!: Date;
}
