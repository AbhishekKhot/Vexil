import { FastifyRequest, FastifyReply } from "fastify";
import { UserRole } from "../entities/User";

export const requireRole = (roles: UserRole[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user;
        if (!user || !roles.includes(user.role)) {
            return reply.code(403).send({ error: "Forbidden: insufficient permissions" });
        }
    };
};
