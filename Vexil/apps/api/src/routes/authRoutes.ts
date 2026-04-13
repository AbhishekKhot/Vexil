import { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/AuthController";
import { AuthService } from "../services/AuthService";
import { User } from "../entities/User";
import { Organization } from "../entities/Organization";
import { LIMITS } from "../app";
import authSchemas from "./schemas/auth.schema.json";

export default async function authRoutes(fastify: FastifyInstance) {
    const ctrl = new AuthController(
        new AuthService(
            fastify.orm.getRepository(User),
            fastify.orm.getRepository(Organization),
        ),
    );

    // Per-route rate limits are tighter than the global default —
    // brute-force and org-spam protection.
    fastify.post("/register", {
        config: { rateLimit: LIMITS.register },
        schema: authSchemas.register,
    }, ctrl.register as any);

    fastify.post("/login", {
        config: { rateLimit: LIMITS.login },
        schema: authSchemas.login,
    }, ctrl.login as any);

    fastify.get("/me", {
        config: { rateLimit: LIMITS.authGeneral },
        preHandler: [fastify.authenticate],
        schema: authSchemas.me,
    }, ctrl.me as any);
}
