import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique } from "typeorm";
import { Flag } from "./Flag";
import { Environment } from "./Environment";

@Entity("flag_environment_configs")
@Unique(["flag", "environment"])
export class FlagEnvironmentConfig {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => Flag, { onDelete: "CASCADE" })
    flag!: Flag;

    @ManyToOne(() => Environment, { onDelete: "CASCADE" })
    environment!: Environment;

    @Column({ default: false })
    isEnabled!: boolean;

    @Column({ type: "simple-json", nullable: true })
    rules?: any;

    @CreateDateColumn()
    createdAt!: Date;
}
