import Redis from "ioredis";

let instance: Redis | null = null;

/**
 * Returns a singleton Redis client.
 * lazyConnect means the connection is established on first command, not at import time —
 * prevents startup failures if Redis is briefly unavailable when the app boots.
 */
export const getRedisClient = (): Redis => {
    if (!instance) {
        instance = new Redis({
            host: process.env.REDIS_HOST || "127.0.0.1",
            port: parseInt(process.env.REDIS_PORT || "6379", 10),
            lazyConnect: true,
        });
        instance.on("error", (err) => console.error("[Redis] Error:", err.message));
    }
    return instance;
};
