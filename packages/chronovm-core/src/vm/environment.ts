// ─────────────────────────────────────────────
// ChronoVM Environment — Lexical Scope Chain
// ─────────────────────────────────────────────
// Environments model lexical scopes.
// Each environment has bindings and an optional parent.
// Lookup walks the chain from inner to outer.
// All operations are PURE — return new VMState.
// ─────────────────────────────────────────────

import type { VMState } from './state';
import type { HeapAddress } from './heap';

/** Branded type alias for environment addresses. */
export type EnvironmentAddress = string & { readonly __brand: 'EnvironmentAddress' };

/**
 * A single lexical environment record.
 * Bindings map variable names to heap addresses.
 */
export type EnvironmentRecord = {
    readonly address: EnvironmentAddress;
    readonly parent: EnvironmentAddress | null;
    readonly bindings: Readonly<Record<string, HeapAddress>>;
};

/**
 * Generate a deterministic environment address from the env counter.
 * Uses a SEPARATE counter from the heap for clean determinism.
 */
function makeEnvironmentAddress(counter: number): EnvironmentAddress {
    return `env@${counter}` as EnvironmentAddress;
}

/**
 * Create a new environment with an optional parent.
 * Pure — returns new VMState + address. Does NOT mutate input.
 * Uses envCounter (separate from allocationCounter).
 */
export function createEnvironment(
    state: VMState,
    parent: EnvironmentAddress | null,
): { state: VMState; address: EnvironmentAddress } {
    const address = makeEnvironmentAddress(state.envCounter);

    const record: EnvironmentRecord = {
        address,
        parent,
        bindings: {},
    };

    return {
        state: {
            ...state,
            environmentRecords: { ...state.environmentRecords, [address]: record },
            envCounter: state.envCounter + 1,
        },
        address,
    };
}

/**
 * Bind a variable name to a heap address in the specified environment.
 * Pure — returns new VMState. Does NOT mutate input.
 */
export function envBind(
    state: VMState,
    envAddress: EnvironmentAddress,
    name: string,
    heapAddress: HeapAddress,
): VMState {
    const record = state.environmentRecords[envAddress];
    if (!record) {
        throw new Error(`[ChronoVM] Environment not found: ${envAddress}`);
    }

    const newRecord: EnvironmentRecord = {
        ...record,
        bindings: { ...record.bindings, [name]: heapAddress },
    };

    return {
        ...state,
        environmentRecords: { ...state.environmentRecords, [envAddress]: newRecord },
    };
}

/**
 * Look up a variable name starting from the given environment,
 * walking the parent chain outward.
 *
 * Pure — does NOT mutate state.
 * Returns the HeapAddress if found, or null if not bound.
 */
export function envLookup(
    state: VMState,
    envAddress: EnvironmentAddress,
    name: string,
): HeapAddress | null {
    let current: EnvironmentAddress | null = envAddress;

    while (current !== null) {
        const record: EnvironmentRecord | undefined = state.environmentRecords[current];
        if (!record) {
            return null;
        }
        if (name in record.bindings) {
            return record.bindings[name]!;
        }
        current = record.parent;
    }

    return null;
}
