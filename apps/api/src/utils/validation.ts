// ─────────────────────────────────────────────
// Zod Validation Schemas
// ─────────────────────────────────────────────
// All request bodies validated with Zod.
// Never trust client JSON shape.
// ─────────────────────────────────────────────

import { z } from "zod";

// ── Auth ──

export const registerSchema = z.object({
    email: z.string().email("Invalid email format").transform((v) => v.toLowerCase().trim()),
    password: z.string().min(8, "Password must be at least 8 characters"),
    name: z.string().optional(),
});

export const loginSchema = z.object({
    email: z.string().email("Invalid email format").transform((v) => v.toLowerCase().trim()),
    password: z.string().min(1, "Password is required"),
});

// ── Projects ──

export const createProjectSchema = z.object({
    name: z.string().min(1, "Name is required").max(255),
    sourceCode: z.string().min(1, "Source code is required"),
    compilerVersion: z.string().min(1, "Compiler version is required"),
});

// ── Members ──

export const addMemberSchema = z.object({
    email: z.string().email("Invalid email format"),
    role: z.enum(["owner", "instructor", "maintainer", "viewer"]),
});

// ── Templates ──

export const updateTemplateSchema = z.object({
    panelModes: z.record(z.string(), z.string()),
    lockedPanels: z.record(z.string(), z.boolean()),
    baseVersion: z.number().int().nullable(),
});

// ── Snapshots ──

export const createSnapshotSchema = z.object({
    microIndex: z.number().int().nonnegative("microIndex must be non-negative"),
    executionHash: z.string().min(1, "executionHash is required"),
});

export const visibilitySchema = z.object({
    visibility: z.enum(["private", "public"]),
});
