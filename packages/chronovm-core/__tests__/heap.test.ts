// ─────────────────────────────────────────────
// ChronoVM Test: Heap (Immutable API)
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { createInitialState, heapAlloc, heapRead, VMError, VMErrorType } from '../src/index.ts';
import type { HeapAddress } from '../src/index.ts';

describe('Heap', () => {
    it('allocates with monotonically increasing addresses', () => {
        const program = [{ opcode: 'HALT' as const }];
        let state = createInitialState(program);

        const r1 = heapAlloc(state, 10);
        state = r1.state;
        const r2 = heapAlloc(state, 20);
        state = r2.state;
        const r3 = heapAlloc(state, 30);

        expect(r1.address).toBe('heap@0');
        expect(r2.address).toBe('heap@1');
        expect(r3.address).toBe('heap@2');
    });

    it('reads back allocated values correctly', () => {
        const program = [{ opcode: 'HALT' as const }];
        let state = createInitialState(program);

        const r1 = heapAlloc(state, 42);
        state = r1.state;
        const r2 = heapAlloc(state, true);
        state = r2.state;
        const r3 = heapAlloc(state, false);
        state = r3.state;

        expect(heapRead(state, r1.address, 0, 0, null)).toBe(42);
        expect(heapRead(state, r2.address, 0, 0, null)).toBe(true);
        expect(heapRead(state, r3.address, 0, 0, null)).toBe(false);
    });

    it('does not mutate original state on alloc', () => {
        const program = [{ opcode: 'HALT' as const }];
        const original = createInitialState(program);
        const originalCounter = original.allocationCounter;
        const originalHeapKeys = Object.keys(original.heap);

        heapAlloc(original, 99);

        // Original must be unchanged
        expect(original.allocationCounter).toBe(originalCounter);
        expect(Object.keys(original.heap)).toEqual(originalHeapKeys);
    });

    it('throws HeapAccessViolation on invalid read', () => {
        const program = [{ opcode: 'HALT' as const }];
        const state = createInitialState(program);

        const badAddr = 'heap@999' as HeapAddress;

        try {
            heapRead(state, badAddr, 0, 0, null);
            expect.fail('Should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(VMError);
            expect((e as VMError).data.type).toBe(VMErrorType.HEAP_ACCESS_VIOLATION);
        }
    });

    it('heap counter is separate from env counter', () => {
        const program = [{ opcode: 'HALT' as const }];
        const state = createInitialState(program);

        // After init: env@0 consumed → envCounter = 1
        // Heap counter starts at 0
        expect(state.envCounter).toBe(1);
        expect(state.allocationCounter).toBe(0);

        const r1 = heapAlloc(state, 10);
        expect(r1.state.allocationCounter).toBe(1);
        expect(r1.state.envCounter).toBe(1); // unchanged
        expect(r1.address).toBe('heap@0');
    });

    it('supports FunctionValue allocation', () => {
        const program = [{ opcode: 'HALT' as const }];
        let state = createInitialState(program);

        const fn = { type: 'function' as const, entry: 5, environment: 'env@0' };
        const r = heapAlloc(state, fn);
        state = r.state;

        const read = heapRead(state, r.address, 0, 0, null);
        expect(read).toEqual(fn);
    });
});
