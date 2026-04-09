import { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

export async function registerOpenApi(fastify: FastifyInstance) {
    fastify.addSchema({ $id: "User", type: "object", properties: { id: { type: "string" }, email: { type: "string" }, role: { type: "string" } } });
    fastify.addSchema({ $id: "Project", type: "object", properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, createdAt: { type: "string" } } });
    fastify.addSchema({ $id: "Environment", type: "object", properties: { id: { type: "string" }, name: { type: "string" }, apiKey: { type: "string" }, createdAt: { type: "string" } } });
    fastify.addSchema({ $id: "Flag", type: "object", properties: { id: { type: "string" }, key: { type: "string" }, description: { type: "string" }, type: { type: "string" }, createdAt: { type: "string" } } });
    fastify.addSchema({ $id: "Segment", type: "object", properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, rules: { type: "array" } } });
    fastify.addSchema({ $id: "FlagConfig", type: "object", properties: { id: { type: "string" }, isEnabled: { type: "boolean" }, strategyType: { type: "string" }, strategyConfig: { type: "object" }, scheduledAt: { type: "string", nullable: true } } });
    fastify.addSchema({ $id: "AuditLog", type: "object", properties: { id: { type: "string" }, action: { type: "string" }, entityType: { type: "string" }, entityId: { type: "string" }, createdAt: { type: "string" } } });
    fastify.addSchema({ $id: "Error", type: "object", properties: { error: { type: "string" } } });

    await fastify.register(swagger, {
        openapi: {
            openapi: "3.0.3",
            info: { title: "Vexil API", description: "Feature Flag Service", version: "1.0.0" },
            components: {
                securitySchemes: {
                    bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
                    apiKeyAuth: { type: "apiKey", in: "header", name: "authorization" },
                },
            },
            tags: [
                { name: "Auth" }, { name: "Projects" }, { name: "Environments" },
                { name: "Flags" }, { name: "Flag Config" }, { name: "Segments" },
                { name: "Analytics" }, { name: "Evaluation" }, { name: "Audit Log" },
            ],
        },
    });

    await fastify.register(swaggerUi, {
        routePrefix: "/docs",
        uiConfig: { docExpansion: "list", deepLinking: true, persistAuthorization: true },
        staticCSP: true,
    });
}
