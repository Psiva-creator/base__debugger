// ─────────────────────────────────────────────
// chronovm-sync — Session & Participant Types
// ─────────────────────────────────────────────
// Pure type definitions and factory functions for
// execution sessions. No mutation. No IO. No network.
// ─────────────────────────────────────────────

// ── Session Role ──

/** Authority role within a live execution session. */
export type SessionRole = 'host' | 'co-host' | 'viewer';

/** Playback state of the session. */
export type PlaybackState = 'paused' | 'playing';

// ── Participant ──

export interface SessionParticipant {
    readonly userId: string;
    readonly role: SessionRole;
    readonly joinedAt: string; // ISO8601
    readonly connected: boolean;
    readonly lastSeenAt: string; // ISO8601
}

// ── Session ──

export interface ExecutionSession {
    readonly sessionId: string;
    readonly projectId: string;
    readonly traceHash: string;
    readonly hostUserId: string;
    readonly currentMicroIndex: number;
    readonly playbackState: PlaybackState;
    readonly speed: number; // steps per second (1–20)
    readonly totalMicroSteps: number;
    readonly participants: readonly SessionParticipant[];
    readonly createdAt: string; // ISO8601
    readonly expiresAt: string; // ISO8601
}

// ── Factories ──

/**
 * Create a new execution session. The creator becomes the host.
 */
export function createSession(
    sessionId: string,
    projectId: string,
    traceHash: string,
    hostUserId: string,
    totalMicroSteps: number,
    createdAt: string,
    expiresAt: string,
): ExecutionSession {
    if (totalMicroSteps < 1) {
        throw new Error('totalMicroSteps must be at least 1');
    }

    const host: SessionParticipant = {
        userId: hostUserId,
        role: 'host',
        joinedAt: createdAt,
        connected: true,
        lastSeenAt: createdAt,
    };

    return {
        sessionId,
        projectId,
        traceHash,
        hostUserId,
        currentMicroIndex: 0,
        playbackState: 'paused',
        speed: 1,
        totalMicroSteps,
        participants: [host],
        createdAt,
        expiresAt,
    };
}

/**
 * Add a participant to a session. Returns a new session.
 * Validates traceHash match.
 */
export function addParticipant(
    session: ExecutionSession,
    userId: string,
    clientTraceHash: string,
    timestamp: string,
): { ok: true; session: ExecutionSession } | { ok: false; reason: string } {
    if (clientTraceHash !== session.traceHash) {
        return {
            ok: false,
            reason: `Trace hash mismatch: expected '${session.traceHash}', got '${clientTraceHash}'`,
        };
    }

    if (session.participants.some(p => p.userId === userId)) {
        return { ok: false, reason: `User '${userId}' is already in the session` };
    }

    const participant: SessionParticipant = {
        userId,
        role: 'viewer',
        joinedAt: timestamp,
        connected: true,
        lastSeenAt: timestamp,
    };

    return {
        ok: true,
        session: {
            ...session,
            participants: [...session.participants, participant],
        },
    };
}

/**
 * Remove a participant from a session.
 */
export function removeParticipant(
    session: ExecutionSession,
    userId: string,
): ExecutionSession {
    return {
        ...session,
        participants: session.participants.filter(p => p.userId !== userId),
    };
}

/**
 * Find a participant by userId.
 */
export function findParticipant(
    session: ExecutionSession,
    userId: string,
): SessionParticipant | undefined {
    return session.participants.find(p => p.userId === userId);
}

/**
 * Update a participant's connected status (e.g., on heartbeat or disconnect).
 */
export function updateParticipantStatus(
    session: ExecutionSession,
    userId: string,
    connected: boolean,
    timestamp: string,
): ExecutionSession {
    return {
        ...session,
        participants: session.participants.map(p =>
            p.userId === userId
                ? { ...p, connected, lastSeenAt: timestamp }
                : p,
        ),
    };
}
