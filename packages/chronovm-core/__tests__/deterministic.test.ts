// ─────────────────────────────────────────────
// ChronoVM Test: Determinism (immutable, no PRINT)
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { runVM, Opcode } from '../src/index.ts';
import type { IRInstruction } from '../src/index.ts';

function runNTimes(program: readonly IRInstruction[], n: number) {
    const results = [];
    for (let i = 0; i < n; i++) {
        results.push(runVM(program));
    }
    return results;
}

function stripSnapshotBrands(trace: unknown): unknown {
    return JSON.parse(JSON.stringify(trace));
}

describe('Determinism', () => {
    it('arithmetic program produces identical traces across 3 runs', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 10 },
            { opcode: Opcode.LOAD_CONST, value: 20 },
            { opcode: Opcode.ADD },
            { opcode: Opcode.HALT },
        ];

        const results = runNTimes(program, 3);
        const traces = results.map((r) => stripSnapshotBrands(r.trace));

        expect(traces[0]).toEqual(traces[1]);
        expect(traces[1]).toEqual(traces[2]);
    });

    it('variable binding program produces identical traces across 3 runs', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 42 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.LOAD, name: 'x' },
            { opcode: Opcode.HALT },
        ];

        const results = runNTimes(program, 3);
        const traces = results.map((r) => stripSnapshotBrands(r.trace));

        expect(traces[0]).toEqual(traces[1]);
        expect(traces[1]).toEqual(traces[2]);
    });

    it('branching program produces identical traces across 3 runs', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 0 },
            { opcode: Opcode.JUMP_IF_FALSE, target: 4 },
            { opcode: Opcode.LOAD_CONST, value: 11 },
            { opcode: Opcode.JUMP, target: 5 },
            { opcode: Opcode.LOAD_CONST, value: 22 },
            { opcode: Opcode.HALT },
        ];

        const results = runNTimes(program, 3);
        const traces = results.map((r) => stripSnapshotBrands(r.trace));

        expect(traces[0]).toEqual(traces[1]);
        expect(traces[1]).toEqual(traces[2]);
    });

    it('heap addresses are identical across runs', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.LOAD_CONST, value: 2 },
            { opcode: Opcode.LOAD_CONST, value: 3 },
            { opcode: Opcode.HALT },
        ];

        const results = runNTimes(program, 2);

        const heapKeys1 = Object.keys(results[0]!.finalState.heap).sort();
        const heapKeys2 = Object.keys(results[1]!.finalState.heap).sort();
        expect(heapKeys1).toEqual(heapKeys2);
    });

    it('function heap addresses are identical across runs', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.MAKE_FUNCTION, entry: 4 },
            { opcode: Opcode.STORE, name: 'f' },
            { opcode: Opcode.LOAD_CONST, value: 42 },
            { opcode: Opcode.HALT },
            // f@4
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.RET },
        ];

        const results = runNTimes(program, 3);
        const heapKeys = results.map((r) => Object.keys(r.finalState.heap).sort());

        expect(heapKeys[0]).toEqual(heapKeys[1]);
        expect(heapKeys[1]).toEqual(heapKeys[2]);
    });

    it('environment addresses are identical across runs', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.MAKE_FUNCTION, entry: 4 },
            { opcode: Opcode.CALL, argCount: 0 },
            { opcode: Opcode.HALT },
            { opcode: Opcode.HALT },
            // fn@4
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.RET },
        ];

        const results = runNTimes(program, 3);
        const envKeys = results.map((r) =>
            Object.keys(r.finalState.environmentRecords).sort()
        );

        expect(envKeys[0]).toEqual(envKeys[1]);
        expect(envKeys[1]).toEqual(envKeys[2]);
    });
});
