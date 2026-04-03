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

    fastify.post("/register", {
        schema: {
            tags: ["Auth"],
            summary: "Register a new user and organization",
            body: {
                type: "object",
                required: ["email", "password", "name", "orgName"],
                properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", minLength: 6 },
                    name: { type: "string" },
                    orgName: { type: "string" },
                },
            },
            response: {
                201: {
                    description: "User registered successfully",
                    type: "object",
                    properties: {
                        token: { type: "string" },
                        user: { $ref: "User#" },
                    },
                },
                400: { description: "Validation error", $ref: "Error#" },
                409: { description: "Email already registered", $ref: "Error#" },
            },
        },
    }, authController.register as any);

    fastify.post("/login", {
        schema: {
            tags: ["Auth"],
            summary: "Login and receive a JWT token",
            body: {
                type: "object",
                required: ["email", "password"],
                properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                },
            },
            response: {
                200: {
                    description: "Login successful",
                    type: "object",
                    properties: {
                        token: { type: "string" },
                        user: { $ref: "User#" },
                    },
                },
                401: { description: "Invalid credentials", $ref: "Error#" },
            },
        },
    }, authController.login as any);

    fastify.get("/me", {
        preHandler: [fastify.authenticate],
        schema: {
            tags: ["Auth"],
            summary: "Get the currently authenticated user",
            security: [{ bearerAuth: [] }],
            response: {
                200: { description: "Current user", $ref: "User#" },
                401: { description: "Unauthorized", $ref: "Error#" },
            },
        },
    }, authController.me as any);
}
