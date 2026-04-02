import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { User } from "./User";
import { Project } from "./Project";

@Entity("organizations")
export class Organization {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string;

    @Column({ unique: true })
    slug!: string;

    @OneToMany(() => User, (user) => user.organization)
    users!: User[];

    @OneToMany(() => Project, (project) => project.organization)
    projects!: Project[];

    @CreateDateColumn()
    createdAt!: Date;
}
