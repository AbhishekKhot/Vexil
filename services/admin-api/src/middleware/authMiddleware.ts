import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import * as jwt from "jsonwebtoken";
import { UserRole } from "../entities/User";

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
    interface FastifyRequest {
        user: {
            id: string;
            email: string;
            organizationId: string;
            role: UserRole;
        }
    }
}

export const authMiddleware = async (fastify: FastifyInstance) => {
    const jwtSecret = process.env.JWT_SECRET || "vexil-dev-secret-change-in-prod";

    fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader) {
                return reply.code(401).send({ error: "Missing authorization header" });
            }

            const token = authHeader.replace("Bearer ", "");
            const decoded = jwt.verify(token, jwtSecret) as any;

            request.user = {
                id: decoded.userId,
                email: decoded.email,
                organizationId: decoded.organizationId,
                role: decoded.role
            };
        } catch (err) {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
};
