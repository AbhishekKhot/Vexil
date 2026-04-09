import { Repository } from "typeorm";
import { User, UserRole } from "../entities/User";
import { Organization } from "../entities/Organization";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

export interface AuthPayload { userId: string; email: string; organizationId: string; role: UserRole }

// Safe shape returned to clients — never includes passwordHash.
export interface SafeUser { id: string; email: string; name: string; role: UserRole }
export interface SafeOrg  { id: string; name: string; slug: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;
// M6: 8h expiry — shorter window limits damage from a stolen token.
const JWT_EXPIRY = "8h";

export class AuthService {
    private readonly jwtSecret: string;
    constructor(private readonly userRepo: Repository<User>, private readonly orgRepo: Repository<Organization>) {
        this.jwtSecret = process.env.JWT_SECRET!; // Guaranteed non-empty — server.ts exits if missing.
    }

    /**
     * Creates a new organization and an ADMIN user in one shot, then issues a JWT.
     * Returns the token so the frontend can authenticate immediately without a separate login call.
     */
    async register(email: string, password: string, name: string, orgName: string) {
        // M3: Validate email format and minimum password length.
        if (!EMAIL_RE.test(email)) throw new Error("Invalid email address.");
        if (password.length < MIN_PASSWORD_LEN) throw new Error(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);

        const slug = orgName.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "");
        const organization = await this.orgRepo.save(this.orgRepo.create({ name: orgName, slug }));
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await this.userRepo.save(this.userRepo.create({ email, passwordHash, name, organizationId: organization.id, role: UserRole.ADMIN }));
        const token = jwt.sign({ userId: user.id, email: user.email, organizationId: organization.id, role: user.role } as AuthPayload, this.jwtSecret, { expiresIn: JWT_EXPIRY });
        // M2: Return only safe fields — never include passwordHash.
        return { token, user: this.toSafeUser(user), organization: this.toSafeOrg(organization) };
    }

    /**
     * Verifies credentials and issues an 8h JWT.
     * passwordHash is selected explicitly because TypeORM excludes it by default (select: false on the entity).
     */
    async login(email: string, password: string) {
        const user = await this.userRepo.findOne({ where: { email }, select: ["id","email","passwordHash","organizationId","role","name"], relations: ["organization"] });
        if (!user) throw new Error("Invalid credentials");
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) throw new Error("Invalid credentials");
        const token = jwt.sign({ userId: user.id, email: user.email, organizationId: user.organizationId, role: user.role } as AuthPayload, this.jwtSecret, { expiresIn: JWT_EXPIRY });
        // M2: Return only safe fields.
        return { token, user: this.toSafeUser(user), organization: this.toSafeOrg(user.organization) };
    }

    async getUserById(id: string): Promise<{ user: SafeUser; organization: SafeOrg } | null> {
        const user = await this.userRepo.findOne({ where: { id }, relations: ["organization"] });
        if (!user) return null;
        // M2: Explicit projection — never return the raw entity which could contain passwordHash.
        return { user: this.toSafeUser(user), organization: this.toSafeOrg(user.organization) };
    }

    private toSafeUser(u: User): SafeUser {
        return { id: u.id, email: u.email, name: u.name, role: u.role };
    }

    private toSafeOrg(o: Organization): SafeOrg {
        return { id: o.id, name: o.name, slug: o.slug };
    }
}
