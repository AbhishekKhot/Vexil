/**
 * EventConsumer — RabbitMQ consumer worker for vexil_events queue.
 *
 * Connects to RabbitMQ and processes evaluation events published by
 * AnalyticsService.ingestEvents(). Events are already persisted to PostgreSQL
 * by the HTTP handler; this worker exists for future pre-aggregation use
 * (e.g., incrementing real-time Redis counters without hitting the DB).
 *
 * Start via server.ts when RABBITMQ_URL is configured.
 * Retries with exponential backoff on connection failure.
 */

import amqplib from "amqplib";

const QUEUE_NAME = "vexil_events";
const MAX_RETRY_DELAY_MS = 30_000;

interface EventPayload {
    environmentId: string;
    events: Array<{
        flagKey: string;
        result: boolean;
        context?: Record<string, unknown>;
        timestamp?: string;
    }>;
}

export class EventConsumer {
    private connection: any = null;
    private channel: any = null;
    private retryDelay = 1_000;
    private running = false;

    async start(url: string): Promise<void> {
        this.running = true;
        await this.connectWithRetry(url);
    }

    async stop(): Promise<void> {
        this.running = false;
        try {
            if (this.channel) await this.channel.close();
            if (this.connection) await this.connection.close();
        } catch {
            // ignore errors on shutdown
        }
        this.channel = null;
        this.connection = null;
    }

    private async connectWithRetry(url: string): Promise<void> {
        while (this.running) {
            try {
                await this.connect(url);
                this.retryDelay = 1_000; // reset on success
                return;
            } catch (err) {
                console.error(
                    `[EventConsumer] Connection failed, retrying in ${this.retryDelay}ms:`,
                    (err as Error).message
                );
                await this.sleep(this.retryDelay);
                this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_DELAY_MS);
            }
        }
    }

    private async connect(url: string): Promise<void> {
        this.connection = await amqplib.connect(url);
        this.channel = await this.connection.createChannel();
        await this.channel.assertQueue(QUEUE_NAME, { durable: true });

        // Process one message at a time
        this.channel.prefetch(1);

        console.log(`[EventConsumer] Listening on queue: ${QUEUE_NAME}`);

        this.connection.on("error", (err: Error) => {
            console.error("[EventConsumer] Connection error:", err.message);
        });

        this.connection.on("close", () => {
            if (this.running) {
                console.warn("[EventConsumer] Connection closed unexpectedly, reconnecting...");
                this.connectWithRetry(url).catch(console.error);
            }
        });

        this.channel.consume(QUEUE_NAME, (msg: any) => {
            if (!msg) return;
            try {
                const payload: EventPayload = JSON.parse(msg.content.toString());
                this.handleEvent(payload);
                this.channel.ack(msg);
            } catch (err) {
                console.error("[EventConsumer] Failed to process message:", (err as Error).message);
                // Reject and discard malformed messages (do not requeue)
                this.channel.nack(msg, false, false);
            }
        });
    }

    private handleEvent(payload: EventPayload): void {
        const { environmentId, events } = payload;
        // Events are already persisted to PostgreSQL by AnalyticsService.ingestEvents().
        // This handler is the extension point for future real-time aggregation:
        //   - Increment Redis counters: HINCRBY env:{envId}:flag:{key} count 1
        //   - Update pre-aggregated daily buckets
        //   - Forward to external analytics sinks
        console.log(
            `[EventConsumer] Processed ${events.length} event(s) for env ${environmentId}`
        );
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export const eventConsumer = new EventConsumer();
