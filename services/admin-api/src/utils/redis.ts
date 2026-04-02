import Redis from "ioredis";

export class RedisClientFactory {
    private static instance: Redis | null = null;

    public static getClient(): Redis {
        if (!this.instance) {
            if (process.env.NODE_ENV === "test") {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const RedisMock = require('ioredis-mock');
                this.instance = new RedisMock();
            } else {
                this.instance = new Redis({
                    host: process.env.REDIS_HOST || "127.0.0.1",
                    port: parseInt(process.env.REDIS_PORT || "6379", 10),
                });
            }
        }
        return this.instance!;
    }
}

export const getRedisClient = () => RedisClientFactory.getClient();
