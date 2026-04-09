import { Repository } from "typeorm";
import { User, UserRole } from "../entities/User";
import { Organization } from "../entities/Organization";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

export interface AuthPayload { userId: string; email: string; organizationId: string; role: UserRole }

export class AuthService {
    private readonly jwtSecret: string;
    constructor(private readonly userRepo: Repository<User>, private readonly orgRepo: Repository<Organization>) {
        this.jwtSecret = process.env.JWT_SECRET || "vexil-dev-secret-change-in-prod";
    }

    /**
     * Creates a new organization and an ADMIN user in one shot, then issues a JWT.
     * Returns the token so the frontend can authenticate immediately without a separate login call.
     * slug is derived from orgName for URL-safe usage.
     */
    async register(email: string, password: string, name: string, orgName: string) {
        const slug = orgName.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "");
        const organization = await this.orgRepo.save(this.orgRepo.create({ name: orgName, slug }));
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await this.userRepo.save(this.userRepo.create({ email, passwordHash, name, organizationId: organization.id, role: UserRole.ADMIN }));
        const token = jwt.sign({ userId: user.id, email: user.email, organizationId: organization.id, role: user.role } as AuthPayload, this.jwtSecret, { expiresIn: "24h" });
        return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role }, organization };
    }

    /**
     * Verifies credentials and issues a 24h JWT.
     * passwordHash is selected explicitly because TypeORM excludes it by default (select: false on the entity).
     */
    async login(email: string, password: string) {
        const user = await this.userRepo.findOne({ where: { email }, select: ["id","email","passwordHash","organizationId","role","name"], relations: ["organization"] });
        if (!user) throw new Error("Invalid credentials");
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) throw new Error("Invalid credentials");
        const token = jwt.sign({ userId: user.id, email: user.email, organizationId: user.organizationId, role: user.role } as AuthPayload, this.jwtSecret, { expiresIn: "24h" });
        return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role }, organization: user.organization };
    }

    async getUserById(id: string) {
        return this.userRepo.findOne({ where: { id }, relations: ["organization"] });
    }
}
