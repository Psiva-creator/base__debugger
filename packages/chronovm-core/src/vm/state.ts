// ─────────────────────────────────────────────
// ChronoVM State — Complete Machine State
// ─────────────────────────────────────────────
// VMState is a plain immutable object. No class. No methods.
// Fully JSON-serializable. Contains everything
// needed to resume, snapshot, or replay execution.
// ─────────────────────────────────────────────

import type { IRInstruction } from '../ir/instructions';
import type { HeapAddress, HeapValue } from './heap';
import type { EnvironmentAddress, EnvironmentRecord } from './environment';

export type StackFrame = {
    readonly returnAddress: number;
    readonly environment: EnvironmentAddress;
};

/**
 * The complete, serializable, IMMUTABLE state of the ChronoVM.
 *
 * Every field is readonly. No mutation allowed.
 * Same initial state + same program → identical execution.
 */
export type VMState = {
    /** The immutable program being executed. */
    readonly program: readonly IRInstruction[];

    /** Program counter — index of the next instruction to execute. */
    readonly pc: number;

    /** Operand stack — holds heap addresses of intermediate values. */
    readonly operandStack: readonly HeapAddress[];

    /** The heap — deterministic address-keyed value store. */
    readonly heap: Readonly<Record<string, HeapValue>>;

    /** All environment records, keyed by environment address. */
    readonly environmentRecords: Readonly<Record<string, EnvironmentRecord>>;

    /** Address of the current (active) environment. */
    readonly currentEnvironment: EnvironmentAddress;

    /** Address of the global environment (root of scope chain). */
    readonly globalEnvironment: EnvironmentAddress;

    /** Monotonically increasing counter for deterministic HEAP address generation. */
    readonly allocationCounter: number;

    /** Monotonically increasing counter for deterministic ENVIRONMENT address generation. */
    readonly envCounter: number;

    /** Number of instructions executed so far. */
    readonly stepCount: number;

    /** Whether the VM is still running (false after HALT or error). */
    readonly isRunning: boolean;

    /** Call stack — tracks active procedure frames. */
    readonly callStack: readonly StackFrame[];

    /** Output buffer — print() calls append here. */
    readonly output: readonly string[];
};

/**
 * Create the initial VM state for a given program.
 *
 * Deterministic: calling this with the same program always
 * produces the same initial state.
 */
export function createInitialState(program: readonly IRInstruction[]): VMState {
    const globalEnvAddress = 'env@0' as EnvironmentAddress;
    const globalRecord: EnvironmentRecord = {
        address: globalEnvAddress,
        parent: null,
        bindings: {},
    };

    return {
        program,
        pc: 0,
        operandStack: [],
        heap: {},
        environmentRecords: { [globalEnvAddress]: globalRecord },
        currentEnvironment: globalEnvAddress,
        globalEnvironment: globalEnvAddress,
        allocationCounter: 0,
        envCounter: 1, // env@0 already consumed
        stepCount: 0,
        isRunning: true,
        callStack: [],
        output: [],
    };
}
