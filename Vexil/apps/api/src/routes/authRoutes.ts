import { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/AuthController";
import { AuthService } from "../services/AuthService";
import { User } from "../entities/User";
import { Organization } from "../entities/Organization";
import { LIMITS } from "../app";

export default async function authRoutes(fastify: FastifyInstance) {
    const authService = new AuthService(fastify.orm.getRepository(User), fastify.orm.getRepository(Organization));
    const ctrl = new AuthController(authService);

    fastify.post("/register", {
        config: { rateLimit: LIMITS.register },
        schema: { tags: ["Auth"], summary: "Register user and organization", body: { type: "object", required: ["email","password","name","orgName"], properties: { email: { type: "string" }, password: { type: "string" }, name: { type: "string" }, orgName: { type: "string" } } } }
    }, ctrl.register as any);

    fastify.post("/login", {
        config: { rateLimit: LIMITS.login },
        schema: { tags: ["Auth"], summary: "Login", body: { type: "object", required: ["email","password"], properties: { email: { type: "string" }, password: { type: "string" } } } }
    }, ctrl.login as any);

    fastify.get("/me", {
        config: { rateLimit: LIMITS.authGeneral },
        preHandler: [fastify.authenticate],
        schema: { tags: ["Auth"], summary: "Current user", security: [{ bearerAuth: [] }] }
    }, ctrl.me as any);
}
