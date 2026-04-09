import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { UserRole } from "../entities/User";

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
    interface FastifyRequest {
        user: { id: string; email: string; organizationId: string; role: UserRole }
    }
}

/**
 * Registers `fastify.authenticate` as a reusable hook for the control plane.
 * Decodes the JWT and attaches the payload to request.user so route handlers
 * don't need to touch the token directly.
 * The API key path (/v1/*) uses a separate auth mechanism in evaluationRoutes.
 */
export const authMiddleware = (fastify: FastifyInstance) => {
    const jwtSecret = process.env.JWT_SECRET!; // Guaranteed non-empty — server.ts exits if missing.
    fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader) return reply.code(401).send({ error: "Missing authorization header" });
            const token = authHeader.replace("Bearer ", "");
            const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string; organizationId: string; role: UserRole };
            request.user = { id: decoded.userId, email: decoded.email, organizationId: decoded.organizationId, role: decoded.role };
        } catch {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
};
