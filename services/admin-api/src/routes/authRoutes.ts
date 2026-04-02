import { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/AuthController";
import { AuthService } from "../services/AuthService";
import { User } from "../entities/User";
import { Organization } from "../entities/Organization";

export default async function authRoutes(fastify: FastifyInstance) {
    const userRepo = fastify.orm.getRepository(User);
    const orgRepo = fastify.orm.getRepository(Organization);

    const authService = new AuthService(userRepo, orgRepo);
    const authController = new AuthController(authService);

    fastify.post("/register", authController.register);
    fastify.post("/login", authController.login);
    
    // Protected route
    fastify.get("/me", { 
        preHandler: [fastify.authenticate] 
    }, authController.me);
}
