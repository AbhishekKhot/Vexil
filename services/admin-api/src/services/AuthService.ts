import { Repository } from "typeorm";
import { User, UserRole } from "../entities/User";
import { Organization } from "../entities/Organization";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

export interface AuthPayload {
    userId: string;
    email: string;
    organizationId: string;
    role: UserRole;
}

export class AuthService {
    private readonly jwtSecret: string;

    constructor(
        private readonly userRepo: Repository<User>,
        private readonly orgRepo: Repository<Organization>
    ) {
        this.jwtSecret = process.env.JWT_SECRET || "vexil-dev-secret-change-in-prod";
    }

    async register(email: string, password: string, name: string, orgName: string) {
        // 1. Create Organization
        const slug = orgName.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "");
        const organization = this.orgRepo.create({
            name: orgName,
            slug: slug
        });
        await this.orgRepo.save(organization);

        // 2. Hash Password
        const passwordHash = await bcrypt.hash(password, 10);

        // 3. Create User (First user in org is ADMIN)
        const user = this.userRepo.create({
            email,
            passwordHash,
            name,
            organizationId: organization.id,
            role: UserRole.ADMIN
        });
        await this.userRepo.save(user);

        return { user, organization };
    }

    async login(email: string, password: string) {
        const user = await this.userRepo.findOne({
            where: { email },
            select: ["id", "email", "passwordHash", "organizationId", "role", "name"],
            relations: ["organization"]
        });

        if (!user) {
            throw new Error("Invalid credentials");
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            throw new Error("Invalid credentials");
        }

        const payload: AuthPayload = {
            userId: user.id,
            email: user.email,
            organizationId: user.organizationId,
            role: user.role
        };

        const token = jwt.sign(payload, this.jwtSecret, { expiresIn: "24h" });

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            organization: user.organization
        };
    }

    async verifyToken(token: string): Promise<AuthPayload> {
        try {
            return jwt.verify(token, this.jwtSecret) as AuthPayload;
        } catch (err) {
            throw new Error("Invalid token");
        }
    }

    async getUserById(id: string) {
        return this.userRepo.findOne({
            where: { id },
            relations: ["organization"]
        });
    }
}
