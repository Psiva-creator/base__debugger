// ─────────────────────────────────────────────
// Auth Service
// ─────────────────────────────────────────────
// Pure business logic for register and login.
// Never returns password_hash. Uses bcrypt (12 rounds)
// and JWT (7d expiry).
// ─────────────────────────────────────────────

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../../config/db";
import { config } from "../../config/env";
import type {
    RegisterInput,
    LoginInput,
    UserRow,
    SafeUser,
    AuthResponse,
    JwtPayload,
} from "./auth.types";

const SALT_ROUNDS = 12;
const JWT_EXPIRY = "7d";

// ── Helpers ──

function toSafeUser(row: UserRow): SafeUser {
    return { id: row.id, email: row.email, name: row.name };
}

function signToken(userId: string): string {
    const payload: JwtPayload = { userId };
    return jwt.sign(payload, config.jwtSecret, { expiresIn: JWT_EXPIRY });
}

// ── Public API ──

export async function register(input: RegisterInput): Promise<AuthResponse> {
    const { email, password, name } = input;

    // Validate
    if (!email || !password) {
        throw Object.assign(new Error("Email and password are required"), { statusCode: 400 });
    }
    if (password.length < 8) {
        throw Object.assign(new Error("Password must be at least 8 characters"), { statusCode: 400 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user
    try {
        const result = await pool.query<UserRow>(
            `INSERT INTO users (email, password_hash, name)
             VALUES ($1, $2, $3)
             RETURNING id, email, password_hash, name, created_at`,
            [email.toLowerCase().trim(), passwordHash, name || null],
        );
        const user = result.rows[0]!;
        const token = signToken(user.id);
        return { token, user: toSafeUser(user) };
    } catch (err: any) {
        // Duplicate email — unique constraint violation
        if (err.code === "23505") {
            throw Object.assign(new Error("Email already registered"), { statusCode: 409 });
        }
        throw err;
    }
}

export async function login(input: LoginInput): Promise<AuthResponse> {
    const { email, password } = input;

    // Validate
    if (!email || !password) {
        throw Object.assign(new Error("Email and password are required"), { statusCode: 400 });
    }

    // Fetch user
    const result = await pool.query<UserRow>(
        `SELECT id, email, password_hash, name, created_at
         FROM users WHERE email = $1`,
        [email.toLowerCase().trim()],
    );
    const user = result.rows[0];
    if (!user) {
        // Generic message to avoid user enumeration
        throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
    }

    // Compare password (bcrypt uses constant-time comparison internally)
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
        throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
    }

    const token = signToken(user.id);
    return { token, user: toSafeUser(user) };
}

export function verifyToken(token: string): JwtPayload {
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
