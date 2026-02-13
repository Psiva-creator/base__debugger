import { describe, it, expect } from 'vitest';
import { runVM, Opcode, collectGarbage } from '../src/index.ts';
import type { IRInstruction, ObjectValue } from '../src/index.ts';

function runNTimes(program: readonly IRInstruction[], n: number, gc: boolean = false) {
    const results = [];
    for (let i = 0; i < n; i++) {
        results.push(runVM(program, { gc }));
    }
    return results;
}

function stripSnapshotBrands(trace: unknown): unknown {
    return JSON.parse(JSON.stringify(trace));
}

describe('Garbage Collection', () => {
    it('collects unreachable object', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },             // heap@0 — stored then overwritten
            { opcode: Opcode.STORE, name: 'tmp' },
            { opcode: Opcode.LOAD_CONST, value: 42 },   // heap@1
            { opcode: Opcode.STORE, name: 'tmp' },     // overwrites 'tmp' → heap@0 now unreachable
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program, { gc: true });
        expect(finalState.heap['heap@0']).toBeUndefined();
        expect(finalState.heap['heap@1']).toBe(42);
    });

    it('preserves reachable object', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program, { gc: true });
        const obj = finalState.heap['heap@0'] as ObjectValue;
        expect(obj).toEqual({ type: 'object', properties: {} });
    });

    it('preserves nested object graph', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },             // heap@0 = inner
            { opcode: Opcode.STORE, name: 'inner' },
            { opcode: Opcode.NEW_OBJECT },             // heap@1 = outer
            { opcode: Opcode.STORE, name: 'outer' },
            { opcode: Opcode.LOAD, name: 'outer' },
            { opcode: Opcode.LOAD, name: 'inner' },
            { opcode: Opcode.SET_PROPERTY, name: 'child' },
            { opcode: Opcode.NEW_OBJECT },             // heap@2 = garbage (stored then overwritten)
            { opcode: Opcode.STORE, name: 'garbage' },
            { opcode: Opcode.LOAD_CONST, value: 0 },    // heap@3
            { opcode: Opcode.STORE, name: 'garbage' }, // heap@2 now unreachable
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program, { gc: true });
        const outer = finalState.heap['heap@1'] as ObjectValue;
        expect(outer.properties['child']).toBe('heap@0');
        expect(finalState.heap['heap@0']).toBeDefined();
        expect(finalState.heap['heap@2']).toBeUndefined();
    });

    it('preserves closure capturing object', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },             // heap@0
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.MAKE_FUNCTION, entry: 8 }, // heap@1 = fn
            { opcode: Opcode.STORE, name: 'fn' },
            { opcode: Opcode.NEW_OBJECT },             // heap@2 = garbage
            { opcode: Opcode.STORE, name: 'trash' },
            { opcode: Opcode.LOAD_CONST, value: 0 },    // heap@3
            { opcode: Opcode.STORE, name: 'trash' },   // heap@2 now unreachable
            { opcode: Opcode.HALT },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.RET },
        ];

        const { finalState } = runVM(program, { gc: true });
        expect(finalState.heap['heap@0']).toBeDefined();
        expect(finalState.heap['heap@1']).toBeDefined();
        expect(finalState.heap['heap@2']).toBeUndefined();
        expect(finalState.heap['heap@3']).toBeDefined();
    });

    it('collects orphaned environment', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.MAKE_FUNCTION, entry: 6 },
            { opcode: Opcode.STORE, name: 'f' },
            { opcode: Opcode.LOAD_CONST, value: 0 },
            { opcode: Opcode.STORE, name: 'f' },       // fn now unreachable → its env orphaned
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.HALT },
            { opcode: Opcode.LOAD_CONST, value: 99 },
            { opcode: Opcode.STORE, name: 'local' },
            { opcode: Opcode.RET },
        ];

        const withoutGC = runVM(program);
        const withGC = runVM(program, { gc: true });

        expect(Object.keys(withGC.finalState.heap).length)
            .toBeLessThan(Object.keys(withoutGC.finalState.heap).length);
    });

    it('produces identical results across 3 runs (determinism)', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'keep' },
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'trash' },
            { opcode: Opcode.LOAD_CONST, value: 0 },
            { opcode: Opcode.STORE, name: 'trash' },
            { opcode: Opcode.HALT },
        ];

        const results = runNTimes(program, 3, true);
        const heaps = results.map((r) => JSON.parse(JSON.stringify(r.finalState.heap)));
        const envs = results.map((r) => JSON.parse(JSON.stringify(r.finalState.environmentRecords)));

        expect(heaps[0]).toEqual(heaps[1]);
        expect(heaps[1]).toEqual(heaps[2]);
        expect(envs[0]).toEqual(envs[1]);
        expect(envs[1]).toEqual(envs[2]);
    });

    it('does not change allocationCounter after GC', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'trash' },
            { opcode: Opcode.LOAD_CONST, value: 0 },
            { opcode: Opcode.STORE, name: 'trash' },
            { opcode: Opcode.HALT },
        ];

        const withoutGC = runVM(program);
        const withGC = runVM(program, { gc: true });

        expect(withGC.finalState.allocationCounter).toBe(withoutGC.finalState.allocationCounter);
    });

    it('GC does not alter trace snapshots', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'trash' },
            { opcode: Opcode.LOAD_CONST, value: 0 },
            { opcode: Opcode.STORE, name: 'trash' },
            { opcode: Opcode.HALT },
        ];

        const withoutGC = runVM(program);
        const withGC = runVM(program, { gc: true });

        const tracesWithout = stripSnapshotBrands(withoutGC.trace);
        const tracesWith = stripSnapshotBrands(withGC.trace);
        expect(tracesWithout).toEqual(tracesWith);
    });

    it('collectGarbage is a pure function', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'trash' },
            { opcode: Opcode.LOAD_CONST, value: 0 },
            { opcode: Opcode.STORE, name: 'trash' },
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program);
        const heapBefore = JSON.parse(JSON.stringify(finalState.heap));
        const gcState = collectGarbage(finalState);
        const heapAfter = JSON.parse(JSON.stringify(finalState.heap));

        expect(heapBefore).toEqual(heapAfter);
        expect(Object.keys(gcState.heap).length).toBeLessThan(Object.keys(finalState.heap).length);
    });
});
