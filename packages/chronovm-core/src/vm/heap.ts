// ─────────────────────────────────────────────
// ChronoVM Heap — Deterministic Memory Allocator
// ─────────────────────────────────────────────
// Addresses are generated from a monotonic counter.
// Same program → same addresses every run.
// No GC. No pointer reuse. All operations are pure.
// ─────────────────────────────────────────────

import type { VMState } from './state';
import { heapAccessViolation } from '../errors/vm-errors';
import type { IRInstruction } from '../ir/instructions';

export type FunctionValue = {
    readonly type: 'function';
    readonly entry: number;
    readonly environment: string;
};

export type ObjectValue = {
    readonly type: 'object';
    readonly properties: Readonly<Record<string, HeapAddress>>;
};

export type ListValue = {
    readonly type: 'list';
    readonly elements: readonly HeapAddress[];
};

export type HeapValue =
    | number
    | boolean
    | string
    | null
    | FunctionValue
    | ObjectValue
    | ListValue;

/** Branded type alias for heap addresses. */
export type HeapAddress = string & { readonly __brand: 'HeapAddress' };

/**
 * Generate a deterministic heap address from the current allocation counter.
 */
function makeHeapAddress(counter: number): HeapAddress {
    return `heap@${counter}` as HeapAddress;
}

/**
 * Allocate a value on the heap. Pure — returns new state + address.
 * Does NOT mutate the input state.
 */
export function heapAlloc(
    state: VMState,
    value: HeapValue,
): { state: VMState; address: HeapAddress } {
    const address = makeHeapAddress(state.allocationCounter);
    return {
        state: {
            ...state,
            heap: { ...state.heap, [address]: value },
            allocationCounter: state.allocationCounter + 1,
        },
        address,
    };
}

/**
 * Read a value from the heap by address.
 * Pure — does not mutate state.
 * Throws HeapAccessViolation if address does not exist.
 */
export function heapRead(
    state: VMState,
    address: HeapAddress,
    pc: number,
    stepCount: number,
    instruction: IRInstruction | null,
): HeapValue {
    if (!(address in state.heap)) {
        throw heapAccessViolation(pc, stepCount, instruction, address);
    }
    return state.heap[address]!;
}
