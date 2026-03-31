import amqplib from "amqplib";

export class RabbitMQConfig {
    private connection: any = null;
    private channel: any = null;
    private readonly queueName = "vexil_events";

    async connect(url: string = process.env.RABBITMQ_URL || "amqp://localhost") {
        if (this.channel) return this.channel;

        this.connection = await amqplib.connect(url);
        this.channel = await this.connection.createChannel();
        await this.channel.assertQueue(this.queueName, { durable: true });

        return this.channel;
    }

    async publishEvent(eventPayload: any): Promise<boolean> {
        if (!this.channel) {
            await this.connect();
        }
        
        return this.channel!.sendToQueue(this.queueName, Buffer.from(JSON.stringify(eventPayload)), {
            persistent: true
        });
    }

    async close(): Promise<void> {
        if (this.channel) await this.channel.close();
        if (this.connection) await this.connection.close();
    }
}

// Singleton for easy use
export const rabbitMQConfig = new RabbitMQConfig();
