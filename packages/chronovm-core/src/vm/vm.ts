// ─────────────────────────────────────────────
// ChronoVM — VM Orchestrator
// ─────────────────────────────────────────────
// Top-level run loop.
// Synchronous. No async. No callbacks.
// Snapshot before every instruction.
// Returns finalState + sealed trace.
// ─────────────────────────────────────────────

import type { IRInstruction } from '../ir/instructions.ts';
import type { VMState } from './state.ts';
import { createInitialState } from './state.ts';
import { step } from './step.ts';
import { createSnapshot } from '../trace/snapshot.ts';
import type { ExecutionTrace } from '../trace/trace.ts';
import { createTrace, appendSnapshot, sealTrace } from '../trace/trace.ts';
import { collectGarbage } from './gc.ts';

/** Maximum instructions before forced halt (prevents infinite loops). */
const DEFAULT_MAX_STEPS = 10_000;

/**
 * Result of a complete VM execution.
 */
export type VMResult = {
    /** Final state after execution completed (or was halted). */
    readonly finalState: VMState;
    /** Sealed, immutable execution trace. */
    readonly trace: Readonly<ExecutionTrace>;
};

export type VMOptions = {
    readonly maxSteps?: number;
    readonly gc?: boolean;
};

export function runVM(
    program: readonly IRInstruction[],
    options: VMOptions = {},
): VMResult {
    const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
    const gcEnabled = options.gc ?? false;

    let state = createInitialState(program);
    const trace = createTrace();

    while (state.isRunning && state.stepCount < maxSteps) {
        const snapshot = createSnapshot(state);
        appendSnapshot(trace, snapshot);
        state = step(state);
    }

    const finalSnapshot = createSnapshot(state);
    appendSnapshot(trace, finalSnapshot);

    const finalState = gcEnabled ? collectGarbage(state) : state;

    return {
        finalState,
        trace: sealTrace(trace),
    };
}

/**
 * Run a program step-by-step with manual control.
 *
 * Returns an iterator-like stepper object for external
 * control (e.g., UI-driven single-stepping).
 */
export function createStepper(program: readonly IRInstruction[]) {
    let state = createInitialState(program);
    const trace = createTrace();

    return {
        /**
         * Execute one instruction. Returns the pre-step snapshot.
         * Returns null if the VM has halted.
         */
        stepOnce() {
            if (!state.isRunning) {
                return null;
            }
            const snapshot = createSnapshot(state);
            appendSnapshot(trace, snapshot);
            state = step(state);
            return snapshot;
        },

        /** Get a read-only reference to the current live state. */
        getState(): Readonly<VMState> {
            return state;
        },

        /** Get the trace accumulated so far. */
        getTrace(): ExecutionTrace {
            return trace;
        },

        /** Seal the trace and return the final result. */
        finalize(): VMResult {
            const finalSnapshot = createSnapshot(state);
            appendSnapshot(trace, finalSnapshot);
            return {
                finalState: state,
                trace: sealTrace(trace),
            };
        },

        /** Whether the VM is still running. */
        get isRunning() {
            return state.isRunning;
        },
    };
}
