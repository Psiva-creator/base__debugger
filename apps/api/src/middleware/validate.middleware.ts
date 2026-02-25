// ─────────────────────────────────────────────
// Validation Middleware
// ─────────────────────────────────────────────
// Validates request body against a Zod schema.
// Rejects invalid payloads with 400.
// ─────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";

/**
 * Middleware factory: validates req.body against schema.
 * On success, replaces req.body with parsed/transformed data.
 * On failure, returns 400 with validation errors.
 */
export function validate(schema: ZodTypeAny) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                const issues = err.issues;
                res.status(400).json({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Invalid request body",
                        details: issues.map((e) => ({
                            field: e.path.join("."),
                            message: e.message,
                        })),
                    },
                });
                return;
            }
            next(err);
        }
    };
}
