// ─────────────────────────────────────────────
// Tests — Authority Model
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    canPerform,
    authorizeAction,
    stepForward,
    stepBackward,
    jumpTo,
    setPlayback,
    transferControl,
    raiseHand,
    dismissHand,
    expireHands,
} from '../src/authority.ts';
import { createSession, addParticipant } from '../src/session.ts';
import type { ExecutionSession } from '../src/session.ts';

const TS = '2026-01-01T00:00:00Z';
const EXP = '2026-01-02T00:00:00Z';

function makeSession(microSteps = 100): ExecutionSession {
    return createSession('sess1', 'proj1', 'hash-abc', 'host1', microSteps, TS, EXP);
}

function addViewer(session: ExecutionSession, userId: string): ExecutionSession {
    const result = addParticipant(session, userId, 'hash-abc', TS);
    if (!result.ok) throw new Error(result.reason);
    return result.session;
}

describe('canPerform', () => {
    it('host can step forward', () => {
        expect(canPerform('host', 'step_forward')).toBe(true);
    });

    it('co-host can step forward', () => {
        expect(canPerform('co-host', 'step_forward')).toBe(true);
    });

    it('viewer cannot step forward', () => {
        expect(canPerform('viewer', 'step_forward')).toBe(false);
    });

    it('only host can transfer control', () => {
        expect(canPerform('host', 'transfer_control')).toBe(true);
        expect(canPerform('co-host', 'transfer_control')).toBe(false);
        expect(canPerform('viewer', 'transfer_control')).toBe(false);
    });

    it('only host can kick', () => {
        expect(canPerform('host', 'kick_participant')).toBe(true);
        expect(canPerform('co-host', 'kick_participant')).toBe(false);
    });
});

describe('authorizeAction', () => {
    it('authorizes host for stepping', () => {
        const session = makeSession();
        const result = authorizeAction(session, 'host1', 'step_forward');
        expect(result.ok).toBe(true);
    });

    it('rejects unknown user', () => {
        const session = makeSession();
        const result = authorizeAction(session, 'unknown', 'step_forward');
        expect(result.ok).toBe(false);
    });

    it('rejects viewer for stepping', () => {
        const session = addViewer(makeSession(), 'viewer1');
        const result = authorizeAction(session, 'viewer1', 'step_forward');
        expect(result.ok).toBe(false);
    });
});

describe('stepForward', () => {
    it('increments microIndex by 1', () => {
        const session = makeSession();
        const result = stepForward(session, 'host1');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.session.currentMicroIndex).toBe(1);
        }
    });

    it('rejects at last step', () => {
        const session = { ...makeSession(5), currentMicroIndex: 4 };
        const result = stepForward(session, 'host1');
        expect(result.ok).toBe(false);
    });

    it('rejects unauthorized user', () => {
        const session = addViewer(makeSession(), 'viewer1');
        const result = stepForward(session, 'viewer1');
        expect(result.ok).toBe(false);
    });

    it('does not mutate original session', () => {
        const session = makeSession();
        const original = { ...session };
        stepForward(session, 'host1');
        expect(session.currentMicroIndex).toBe(original.currentMicroIndex);
    });
});

describe('stepBackward', () => {
    it('decrements microIndex by 1', () => {
        const session = { ...makeSession(), currentMicroIndex: 5 };
        const result = stepBackward(session, 'host1');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.session.currentMicroIndex).toBe(4);
        }
    });

    it('rejects at first step', () => {
        const session = makeSession(); // index 0
        const result = stepBackward(session, 'host1');
        expect(result.ok).toBe(false);
    });
});

describe('jumpTo', () => {
    it('jumps to target index', () => {
        const session = makeSession(100);
        const result = jumpTo(session, 'host1', 50);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.session.currentMicroIndex).toBe(50);
        }
    });

    it('clamps to valid range (too high)', () => {
        const session = makeSession(10);
        const result = jumpTo(session, 'host1', 999);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.session.currentMicroIndex).toBe(9);
        }
    });

    it('clamps to valid range (negative)', () => {
        const session = makeSession(10);
        const result = jumpTo(session, 'host1', -5);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.session.currentMicroIndex).toBe(0);
        }
    });
});

describe('setPlayback', () => {
    it('sets playback to playing', () => {
        const session = makeSession();
        const result = setPlayback(session, 'host1', 'playing');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.session.playbackState).toBe('playing');
        }
    });

    it('clamps speed to 1–20', () => {
        const session = makeSession();
        const result = setPlayback(session, 'host1', undefined, 50);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.session.speed).toBe(20);
        }
    });

    it('rejects viewer', () => {
        const session = addViewer(makeSession(), 'viewer1');
        const result = setPlayback(session, 'viewer1', 'playing');
        expect(result.ok).toBe(false);
    });
});

describe('transferControl', () => {
    it('host can promote viewer to co-host', () => {
        const session = addViewer(makeSession(), 'viewer1');
        const result = transferControl(session, 'host1', 'viewer1', 'co-host');
        expect(result.ok).toBe(true);
        if (result.ok) {
            const viewer = result.session.participants.find(p => p.userId === 'viewer1');
            expect(viewer?.role).toBe('co-host');
        }
    });

    it('host cannot change own role', () => {
        const session = makeSession();
        const result = transferControl(session, 'host1', 'host1', 'viewer');
        expect(result.ok).toBe(false);
    });

    it('cannot assign host role via transfer', () => {
        const session = addViewer(makeSession(), 'viewer1');
        const result = transferControl(session, 'host1', 'viewer1', 'host');
        expect(result.ok).toBe(false);
    });

    it('viewer cannot transfer control', () => {
        const session = addViewer(makeSession(), 'viewer1');
        const result = transferControl(session, 'viewer1', 'host1', 'viewer');
        expect(result.ok).toBe(false);
    });
});

describe('raiseHand', () => {
    it('adds a request to the queue', () => {
        const queue = raiseHand([], 'viewer1', 'I have a question', TS);
        expect(queue).toHaveLength(1);
        expect(queue[0]!.userId).toBe('viewer1');
    });

    it('deduplicates requests from same user', () => {
        const q1 = raiseHand([], 'viewer1', 'question 1', TS);
        const q2 = raiseHand(q1, 'viewer1', 'question 2', TS);
        expect(q2).toHaveLength(1);
    });
});

describe('dismissHand', () => {
    it('removes a request', () => {
        const q1 = raiseHand([], 'viewer1', 'q', TS);
        const q2 = dismissHand(q1, 'viewer1');
        expect(q2).toHaveLength(0);
    });
});

describe('expireHands', () => {
    it('removes expired requests', () => {
        const queue = raiseHand([], 'viewer1', 'q', '2026-01-01T00:00:00Z');
        const result = expireHands(queue, '2026-01-01T00:01:00Z', 30_000); // 30s max age
        expect(result).toHaveLength(0); // 60s old > 30s max
    });

    it('keeps fresh requests', () => {
        const queue = raiseHand([], 'viewer1', 'q', '2026-01-01T00:00:50Z');
        const result = expireHands(queue, '2026-01-01T00:01:00Z', 30_000); // only 10s old
        expect(result).toHaveLength(1);
    });
});
