import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique } from "typeorm";
import { Flag } from "./Flag";
import { Environment } from "./Environment";

/**
 * FlagEnvironmentConfig
 *
 * Stores the per-environment configuration for a flag.
 * Each flag × environment pair has exactly one config row.
 *
 * Strategy fields:
 *  - `strategyType`: discriminator key (e.g., "rollout", "ab_test")
 *  - `strategyConfig`: typed JSON blob for the selected strategy
 *  - `isEnabled`: used by the BooleanStrategy and as a master kill-switch
 *
 * Legacy rows (created before strategy support) will have strategyType = null,
 * which the EvaluationEngine treats as "boolean" — fully backwards-compatible.
 */
@Entity("flag_environment_configs")
@Unique(["flag", "environment"])
export class FlagEnvironmentConfig {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => Flag, { onDelete: "CASCADE", eager: false })
    flag!: Flag;

    @ManyToOne(() => Environment, { onDelete: "CASCADE", eager: false })
    environment!: Environment;

    /** Master on/off switch — BooleanStrategy uses this directly */
    @Column({ default: false })
    isEnabled!: boolean;

    /**
     * Strategy type discriminator.
     * Valid values: "boolean" | "rollout" | "targeted_rollout" | "user_targeting" |
     *               "attribute_matching" | "ab_test" | "time_window" | "prerequisite"
     * Defaults to "boolean" for backwards compatibility.
     */
    @Column({ default: "boolean" })
    strategyType!: string;

    /**
     * Strategy-specific configuration as a typed JSON object.
     * Schema is validated by StrategyFactory.parse() before saving.
     * Examples:
     *   rollout: { percentage: 20, hashAttribute: "userId" }
     *   ab_test: { variants: [...], hashAttribute: "userId" }
     */
    @Column({ type: "jsonb", nullable: true })
    strategyConfig?: Record<string, unknown>;

    /**
     * @deprecated Use strategyConfig.rules instead.
     * Kept for backward compatibility with legacy flag configs.
     * The EvaluationEngine will prefer strategyType/strategyConfig over this field.
     */
    @Column({ type: "simple-json", nullable: true })
    rules?: unknown;

    /**
     * Optional timestamp for when a scheduled config change should apply.
     */
    @Column({ type: "timestamp", nullable: true })
    scheduledAt?: Date;

    /**
     * The future state to apply when scheduledAt is reached.
     * Expected schema: { isEnabled: boolean, strategyType: string, strategyConfig?: any }
     */
    @Column({ type: "jsonb", nullable: true })
    scheduledConfig?: Record<string, unknown>;

    @CreateDateColumn()
    createdAt!: Date;
}
