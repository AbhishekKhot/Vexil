import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Flag } from "./Flag";
import { Environment } from "./Environment";
import { Organization } from "./Organization";

@Entity("projects")
export class Project {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string;

    @Column({ nullable: true })
    description?: string;

    @Column({ name: "organization_id" })
    organizationId!: string;

    @ManyToOne(() => Organization, (org) => org.projects)
    @JoinColumn({ name: "organization_id" })
    organization!: Organization;

    @OneToMany(() => Flag, (flag) => flag.project)
    flags!: Flag[];

    @OneToMany(() => Environment, (env) => env.project)
    environments!: Environment[];

    @CreateDateColumn()
    createdAt!: Date;
}