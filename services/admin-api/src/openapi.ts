import { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

export async function registerOpenApi(fastify: FastifyInstance) {
    // Register shared schemas so routes can use $ref
    fastify.addSchema({
        $id: "User",
        type: "object",
        properties: {
            id: { type: "string" },
            email: { type: "string" },
            role: { type: "string", enum: ["ADMIN", "MEMBER", "VIEWER"] },
        },
    });

    fastify.addSchema({
        $id: "Project",
        type: "object",
        properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
        },
    });

    fastify.addSchema({
        $id: "Environment",
        type: "object",
        properties: {
            id: { type: "string" },
            name: { type: "string" },
            apiKey: { type: "string" },
            projectId: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
        },
    });

    fastify.addSchema({
        $id: "Flag",
        type: "object",
        properties: {
            id: { type: "string" },
            key: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            type: { type: "string", enum: ["boolean", "string", "number", "json"] },
            projectId: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
        },
    });

    fastify.addSchema({
        $id: "Segment",
        type: "object",
        properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            rules: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        attribute: { type: "string" },
                        operator: { type: "string", enum: ["eq", "neq", "gt", "lt", "in", "nin", "regex"] },
                        values: { type: "array", items: { type: "string" } },
                    },
                },
            },
        },
    });

    fastify.addSchema({
        $id: "FlagConfig",
        type: "object",
        properties: {
            id: { type: "string" },
            flagId: { type: "string" },
            environmentId: { type: "string" },
            isEnabled: { type: "boolean" },
            strategyType: { type: "string" },
            strategyConfig: { type: "object" },
            scheduledAt: { type: "string", format: "date-time", nullable: true },
        },
    });

    fastify.addSchema({
        $id: "AuditLog",
        type: "object",
        properties: {
            id: { type: "string" },
            action: { type: "string" },
            entityType: { type: "string" },
            entityId: { type: "string" },
            userId: { type: "string" },
            projectId: { type: "string" },
            metadata: { type: "object" },
            createdAt: { type: "string", format: "date-time" },
        },
    });

    fastify.addSchema({
        $id: "Error",
        type: "object",
        properties: {
            error: { type: "string" },
        },
    });

    await fastify.register(swagger, {
        openapi: {
            openapi: "3.0.3",
            info: {
                title: "Vexil API",
                description: `
## Control Plane (\`/api/*\`) — JWT Bearer Auth
Obtain a token via \`POST /api/auth/login\`, then pass it as \`Authorization: Bearer <token>\`.

## Data Plane (\`/v1/*\`) — API Key Auth
Use an environment API key (format: \`vex_...\`) in the \`x-api-key\` header.
Retrieve keys from the Environments page or via \`GET /api/projects/:id/environments\`.
`,
                version: "1.0.0",
            },
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "JWT",
                    },
                    apiKeyAuth: {
                        type: "apiKey",
                        in: "header",
                        name: "x-api-key",
                    },
                },
            },
            tags: [
                { name: "Auth", description: "Authentication — register, login, current user" },
                { name: "Projects", description: "Project CRUD (JWT)" },
                { name: "Environments", description: "Environment CRUD + API key rotation (JWT)" },
                { name: "Flags", description: "Feature flag CRUD (JWT)" },
                { name: "Flag Config", description: "Per-environment flag configuration and strategy (JWT)" },
                { name: "Segments", description: "User segment CRUD with rule builder (JWT)" },
                { name: "Analytics", description: "Event ingestion (API key) and stats dashboard (JWT)" },
                { name: "Evaluation", description: "Flag evaluation for SDKs (API key)" },
                { name: "Audit Log", description: "Immutable audit trail (JWT)" },
            ],
        },
    });

    await fastify.register(swaggerUi, {
        routePrefix: "/docs",
        uiConfig: {
            docExpansion: "list",
            deepLinking: true,
            persistAuthorization: true,
        },
        staticCSP: true,
    });
}
