import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Organization } from "./Organization";

export enum UserRole {
    ADMIN = "admin",
    MEMBER = "member",
    VIEWER = "viewer"
}

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string;

    @Column({ unique: true })
    email!: string;

    @Column({ select: false }) // Don't return password by default
    passwordHash!: string;

    @Column({
        type: "enum",
        enum: UserRole,
        default: UserRole.MEMBER
    })
    role!: UserRole;

    @Column({ name: "organization_id" })
    organizationId!: string;

    @ManyToOne(() => Organization, (organization) => organization.users)
    @JoinColumn({ name: "organization_id" })
    organization!: Organization;

    @CreateDateColumn()
    createdAt!: Date;
}
