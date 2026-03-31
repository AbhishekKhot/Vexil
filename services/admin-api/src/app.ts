import Fastify from "fastify";
import { DataSource } from "typeorm";
import projectRoutes from "./routes/projectRoutes";
import environmentRoutes from "./routes/environmentRoutes";
import flagRoutes from "./routes/flagRoutes";
import flagConfigRoutes from "./routes/flagConfigRoutes";
import segmentRoutes from "./routes/segmentRoutes";
import evaluationRoutes from "./routes/evaluationRoutes";

declare module 'fastify' {
    interface FastifyInstance {
        orm: DataSource;
    }
}

export function buildApp(dataSource: DataSource) {
    const fastify = Fastify({ logger: false });

    // Decorate fastify with TypeORM instance
    fastify.decorate("orm", dataSource);

    // Control Plane
    fastify.register(projectRoutes, { prefix: "/api/projects" });
    fastify.register(environmentRoutes, { prefix: "/api/projects" });
    fastify.register(flagRoutes, { prefix: "/api/projects" });
    fastify.register(flagConfigRoutes, { prefix: "/api/projects" });
    fastify.register(segmentRoutes, { prefix: "/api/projects" });

    // Data Plane (Edge)
    fastify.register(evaluationRoutes, { prefix: "/v1" });
    const analyticsRoutes = require("./routes/analyticsRoutes").default;
    fastify.register(analyticsRoutes, { prefix: "/v1" });

    return fastify;
}
