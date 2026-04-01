import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from "typeorm";
import { Flag } from "./Flag";
import { Environment } from "./Environment";

@Entity("projects")
export class Project {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string;

    @Column({ nullable: true })
    description?: string;

    @OneToMany(() => Flag, (flag) => flag.project)
    flags!: Flag[];

    @OneToMany(() => Environment, (env) => env.project)
    environments!: Environment[];

    @CreateDateColumn()
    createdAt!: Date;
}