import { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "../services/AuthService";

export class AuthController {
    constructor(private readonly authService: AuthService) {}

    register = async (request: FastifyRequest<{ Body: { email: string; password: string; name: string; orgName: string } }>, reply: FastifyReply) => {
        try {
            const { email, password, name, orgName } = request.body;
            if (!email || !password || !name || !orgName) return reply.code(400).send({ error: "Missing required fields" });
            // M3: Validation (email format + min password) is enforced in AuthService.register().
            const result = await this.authService.register(email, password, name, orgName);
            return reply.code(201).send(result);
        } catch (err: any) { return reply.code(400).send({ error: err.message }); }
    };

    login = async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
        try {
            const { email, password } = request.body;
            if (!email || !password) return reply.code(400).send({ error: "Email and password are required" });
            const result = await this.authService.login(email, password);
            return reply.code(200).send(result);
        } catch (err: any) { return reply.code(401).send({ error: err.message }); }
    };

    me = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // M2: getUserById now returns an explicit safe projection, never the raw entity.
            const result = await this.authService.getUserById(request.user.id);
            if (!result) return reply.code(404).send({ error: "User not found" });
            return reply.code(200).send(result);
        } catch { return reply.code(500).send({ error: "Internal Server Error" }); }
    };
}
