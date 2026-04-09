import { FastifyRequest, FastifyReply } from "fastify";
import { UserRole } from "../entities/User";

export const requireRole = (roles: UserRole[]) => async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !roles.includes(request.user.role))
        return reply.code(403).send({ error: "Forbidden: insufficient permissions" });
};
