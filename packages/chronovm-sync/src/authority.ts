// ─────────────────────────────────────────────
// chronovm-sync — Authority Model
// ─────────────────────────────────────────────
// Pure functions for stepping authority, control
// transfer, and raise-hand queue management.
// No mutation. No IO. No network.
// ─────────────────────────────────────────────

import type {
    ExecutionSession,
    SessionRole,
    PlaybackState,
} from './session.ts';
import { findParticipant } from './session.ts';

// ── Authority Actions ──

export type SessionAction =
    | 'step_forward'
    | 'step_backward'
    | 'jump_to'
    | 'set_playback'
    | 'transfer_control'
    | 'kick_participant';

// ── Permission Matrix ──

const SESSION_PERMISSIONS: Readonly<Record<SessionAction, readonly SessionRole[]>> = {
    'step_forward': ['host', 'co-host'],
    'step_backward': ['host', 'co-host'],
    'jump_to': ['host', 'co-host'],
    'set_playback': ['host', 'co-host'],
    'transfer_control': ['host'],
    'kick_participant': ['host'],
};

/**
 * Check whether a session role can perform an action.
 */
export function canPerform(role: SessionRole, action: SessionAction): boolean {
    return SESSION_PERMISSIONS[action].includes(role);
}

/**
 * Validate that a user can perform an action in a session.
 * Returns the participant's role if authorized, or an error.
 */
export function authorizeAction(
    session: ExecutionSession,
    userId: string,
    action: SessionAction,
): { ok: true; role: SessionRole } | { ok: false; reason: string } {
    const participant = findParticipant(session, userId);
    if (!participant) {
        return { ok: false, reason: `User '${userId}' is not in the session` };
    }
    if (!participant.connected) {
        return { ok: false, reason: `User '${userId}' is disconnected` };
    }
    if (!canPerform(participant.role, action)) {
        return {
            ok: false,
            reason: `Role '${participant.role}' cannot perform '${action}'`,
        };
    }
    return { ok: true, role: participant.role };
}

// ── Stepping Operations ──

export type StepResult =
    | { ok: true; session: ExecutionSession }
    | { ok: false; reason: string };

/**
 * Step forward by one micro-step.
 */
export function stepForward(
    session: ExecutionSession,
    userId: string,
): StepResult {
    const auth = authorizeAction(session, userId, 'step_forward');
    if (!auth.ok) return auth;

    if (session.currentMicroIndex >= session.totalMicroSteps - 1) {
        return { ok: false, reason: 'Already at last step' };
    }

    return {
        ok: true,
        session: {
            ...session,
            currentMicroIndex: session.currentMicroIndex + 1,
        },
    };
}

/**
 * Step backward by one micro-step.
 */
export function stepBackward(
    session: ExecutionSession,
    userId: string,
): StepResult {
    const auth = authorizeAction(session, userId, 'step_backward');
    if (!auth.ok) return auth;

    if (session.currentMicroIndex <= 0) {
        return { ok: false, reason: 'Already at first step' };
    }

    return {
        ok: true,
        session: {
            ...session,
            currentMicroIndex: session.currentMicroIndex - 1,
        },
    };
}

/**
 * Jump to a specific micro-step index. Clamps to valid range.
 */
export function jumpTo(
    session: ExecutionSession,
    userId: string,
    targetIndex: number,
): StepResult {
    const auth = authorizeAction(session, userId, 'jump_to');
    if (!auth.ok) return auth;

    const clamped = Math.max(0, Math.min(targetIndex, session.totalMicroSteps - 1));

    return {
        ok: true,
        session: {
            ...session,
            currentMicroIndex: clamped,
        },
    };
}

/**
 * Set playback state and/or speed.
 */
export function setPlayback(
    session: ExecutionSession,
    userId: string,
    playbackState?: PlaybackState,
    speed?: number,
): StepResult {
    const auth = authorizeAction(session, userId, 'set_playback');
    if (!auth.ok) return auth;

    const newSpeed = speed !== undefined
        ? Math.max(1, Math.min(speed, 20)) // clamp 1–20
        : session.speed;

    return {
        ok: true,
        session: {
            ...session,
            playbackState: playbackState ?? session.playbackState,
            speed: newSpeed,
        },
    };
}

// ── Control Transfer ──

/**
 * Transfer control: promote a viewer to co-host, or demote a co-host.
 * Only the host can do this.
 */
export function transferControl(
    session: ExecutionSession,
    hostUserId: string,
    targetUserId: string,
    newRole: SessionRole,
): StepResult {
    const auth = authorizeAction(session, hostUserId, 'transfer_control');
    if (!auth.ok) return auth;

    if (targetUserId === hostUserId) {
        return { ok: false, reason: 'Host cannot change own role via transfer' };
    }

    const target = findParticipant(session, targetUserId);
    if (!target) {
        return { ok: false, reason: `User '${targetUserId}' not found in session` };
    }

    if (newRole === 'host') {
        return { ok: false, reason: 'Cannot transfer host role — use dedicated host handoff' };
    }

    return {
        ok: true,
        session: {
            ...session,
            participants: session.participants.map(p =>
                p.userId === targetUserId ? { ...p, role: newRole } : p,
            ),
        },
    };
}

// ── Raise Hand Queue ──

export interface RaiseHandRequest {
    readonly userId: string;
    readonly reason: string;
    readonly requestedAt: string; // ISO8601
}

/**
 * Add a raise-hand request to the queue.
 */
export function raiseHand(
    queue: readonly RaiseHandRequest[],
    userId: string,
    reason: string,
    timestamp: string,
): readonly RaiseHandRequest[] {
    // Deduplicate — only one request per user
    if (queue.some(r => r.userId === userId)) {
        return queue;
    }
    return [...queue, { userId, reason, requestedAt: timestamp }];
}

/**
 * Dismiss a raise-hand request.
 */
export function dismissHand(
    queue: readonly RaiseHandRequest[],
    userId: string,
): readonly RaiseHandRequest[] {
    return queue.filter(r => r.userId !== userId);
}

/**
 * Auto-expire raise-hand requests older than `maxAgeMs` milliseconds.
 */
export function expireHands(
    queue: readonly RaiseHandRequest[],
    now: string,
    maxAgeMs: number,
): readonly RaiseHandRequest[] {
    const nowMs = new Date(now).getTime();
    return queue.filter(r => {
        const ageMs = nowMs - new Date(r.requestedAt).getTime();
        return ageMs < maxAgeMs;
    });
}
