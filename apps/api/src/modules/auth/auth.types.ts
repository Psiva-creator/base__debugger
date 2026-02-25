// ─────────────────────────────────────────────
// Auth Types
// ─────────────────────────────────────────────

export interface RegisterInput {
    email: string;
    password: string;
    name?: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface UserRow {
    id: string;
    email: string;
    password_hash: string;
    name: string | null;
    created_at: Date;
}

export interface SafeUser {
    id: string;
    email: string;
    name: string | null;
}

export interface AuthResponse {
    token: string;
    user: SafeUser;
}

export interface JwtPayload {
    userId: string;
}

// Extend Express Request
declare global {
    namespace Express {
        interface Request {
            user?: { id: string };
        }
    }
}
