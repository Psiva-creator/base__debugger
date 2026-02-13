import { describe, it, expect } from 'vitest';
import { runVM, Opcode, heapRead, VMError, VMErrorType } from '../src/index.ts';
import type { IRInstruction, ObjectValue, HeapAddress } from '../src/index.ts';

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

describe('Objects', () => {
    it('creates an empty object on the heap', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program);
        const objAddr = finalState.operandStack[0]!;
        const obj = heapRead(finalState, objAddr, 0, 0, null as unknown as IRInstruction);
        expect(obj).toEqual({ type: 'object', properties: {} });
    });

    it('sets a property on an object (in-place)', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },             // heap@0 = empty obj
            { opcode: Opcode.LOAD_CONST, value: 42 },   // heap@1 = 42
            { opcode: Opcode.SET_PROPERTY, name: 'x' }, // updates heap@0 in-place
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program);
        const obj = finalState.heap['heap@0'] as ObjectValue;
        expect(obj.type).toBe('object');
        expect(obj.properties['x']).toBe('heap@1');
        const xVal = heapRead(finalState, 'heap@1' as HeapAddress, 0, 0, null as unknown as IRInstruction);
        expect(xVal).toBe(42);
    });

    it('gets a property from an object', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },             // heap@0
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },      // push heap@0
            { opcode: Opcode.LOAD_CONST, value: 77 },   // heap@1
            { opcode: Opcode.SET_PROPERTY, name: 'k' }, // heap@0.k = heap@1
            { opcode: Opcode.LOAD, name: 'obj' },      // push heap@0 (same addr, now has 'k')
            { opcode: Opcode.GET_PROPERTY, name: 'k' }, // push heap@1
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program);
        const topAddr = finalState.operandStack[finalState.operandStack.length - 1]!;
        const val = heapRead(finalState, topAddr, 0, 0, null as unknown as IRInstruction);
        expect(val).toBe(77);
    });

    it('supports nested object references', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },             // heap@0 = inner
            { opcode: Opcode.STORE, name: 'inner' },
            { opcode: Opcode.NEW_OBJECT },             // heap@1 = outer
            { opcode: Opcode.LOAD, name: 'inner' },    // push heap@0
            { opcode: Opcode.SET_PROPERTY, name: 'child' }, // heap@1.child = heap@0
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program);
        const outerObj = finalState.heap['heap@1'] as ObjectValue;
        expect(outerObj.type).toBe('object');
        expect(outerObj.properties['child']).toBe('heap@0');
        const innerObj = finalState.heap['heap@0'] as ObjectValue;
        expect(innerObj.type).toBe('object');
    });

    it('preserves object identity — two separate objects are distinct', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'a' },
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'b' },
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program);
        const obj0 = finalState.heap['heap@0'] as ObjectValue;
        const obj1 = finalState.heap['heap@1'] as ObjectValue;
        expect(obj0).toEqual({ type: 'object', properties: {} });
        expect(obj1).toEqual({ type: 'object', properties: {} });
        expect('heap@0').not.toBe('heap@1');
    });

    it('maintains deterministic property order', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.SET_PROPERTY, name: 'alpha' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 2 },
            { opcode: Opcode.SET_PROPERTY, name: 'beta' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 3 },
            { opcode: Opcode.SET_PROPERTY, name: 'gamma' },
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program);
        const obj = finalState.heap['heap@0'] as ObjectValue;
        expect(Object.keys(obj.properties)).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('closure captures an object address', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.MAKE_FUNCTION, entry: 6 },
            { opcode: Opcode.CALL, argCount: 0 },
            { opcode: Opcode.HALT },
            { opcode: Opcode.HALT },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.RET },
        ];

        const { finalState } = runVM(program);
        expect(finalState.operandStack.length).toBeGreaterThan(0);
        const topAddr = finalState.operandStack[finalState.operandStack.length - 1]!;
        const val = heapRead(finalState, topAddr, 0, 0, null as unknown as IRInstruction);
        expect(val).toEqual({ type: 'object', properties: {} });
    });

    it('multiple objects remain isolated', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },             // heap@0 = A
            { opcode: Opcode.LOAD_CONST, value: 100 },  // heap@1
            { opcode: Opcode.SET_PROPERTY, name: 'p' }, // heap@0.p = heap@1

            { opcode: Opcode.NEW_OBJECT },             // heap@2 = B
            { opcode: Opcode.LOAD_CONST, value: 200 },  // heap@3
            { opcode: Opcode.SET_PROPERTY, name: 'q' }, // heap@2.q = heap@3

            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program);
        const objA = finalState.heap['heap@0'] as ObjectValue;
        const objB = finalState.heap['heap@2'] as ObjectValue;

        expect(objA.properties).toEqual({ p: 'heap@1' });
        expect(objB.properties).toEqual({ q: 'heap@3' });
        expect(Object.keys(objA.properties)).not.toContain('q');
        expect(Object.keys(objB.properties)).not.toContain('p');
    });

    it('produces identical traces across 3 runs (determinism)', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.SET_PROPERTY, name: 'x' },
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.LOAD_CONST, value: 2 },
            { opcode: Opcode.SET_PROPERTY, name: 'y' },
            { opcode: Opcode.HALT },
        ];

        const results = runNTimes(program, 3);
        const traces = results.map((r) => stripSnapshotBrands(r.trace));
        const heaps = results.map((r) => JSON.parse(JSON.stringify(r.finalState.heap)));

        expect(traces[0]).toEqual(traces[1]);
        expect(traces[1]).toEqual(traces[2]);
        expect(heaps[0]).toEqual(heaps[1]);
        expect(heaps[1]).toEqual(heaps[2]);
    });

    it('SET_PROPERTY preserves reference identity', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },             // heap@0
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 99 },   // heap@1
            { opcode: Opcode.SET_PROPERTY, name: 'val' },
            { opcode: Opcode.LOAD, name: 'obj' },      // same heap@0
            { opcode: Opcode.GET_PROPERTY, name: 'val' },
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program);
        const obj = finalState.heap['heap@0'] as ObjectValue;
        expect(obj.type).toBe('object');
        expect(obj.properties['val']).toBe('heap@1');
        const topAddr = finalState.operandStack[finalState.operandStack.length - 1]!;
        expect(topAddr).toBe('heap@1');
        expect(heapRead(finalState, topAddr, 0, 0, null as unknown as IRInstruction)).toBe(99);
    });

    it('multiple bindings to same object observe mutation', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },             // heap@0
            { opcode: Opcode.STORE, name: 'a' },
            { opcode: Opcode.LOAD, name: 'a' },
            { opcode: Opcode.STORE, name: 'b' },       // b = a (same heap@0)
            { opcode: Opcode.LOAD, name: 'a' },
            { opcode: Opcode.LOAD_CONST, value: 42 },   // heap@1
            { opcode: Opcode.SET_PROPERTY, name: 'x' }, // heap@0.x = heap@1
            { opcode: Opcode.LOAD, name: 'b' },        // push heap@0 via 'b'
            { opcode: Opcode.GET_PROPERTY, name: 'x' }, // should find 'x' → heap@1
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program);
        const topAddr = finalState.operandStack[finalState.operandStack.length - 1]!;
        expect(topAddr).toBe('heap@1');
        expect(heapRead(finalState, topAddr, 0, 0, null as unknown as IRInstruction)).toBe(42);
    });

    it('throws INVALID_OBJECT_ACCESS for SET_PROPERTY on non-object', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 42 },
            { opcode: Opcode.LOAD_CONST, value: 10 },
            { opcode: Opcode.SET_PROPERTY, name: 'x' },
            { opcode: Opcode.HALT },
        ];

        expect(() => runVM(program)).toThrow(VMError);
        try {
            runVM(program);
        } catch (e) {
            expect((e as VMError).data.type).toBe(VMErrorType.INVALID_OBJECT_ACCESS);
        }
    });

    it('throws PROPERTY_NOT_FOUND for GET_PROPERTY on missing key', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.GET_PROPERTY, name: 'missing' },
            { opcode: Opcode.HALT },
        ];

        expect(() => runVM(program)).toThrow(VMError);
        try {
            runVM(program);
        } catch (e) {
            expect((e as VMError).data.type).toBe(VMErrorType.PROPERTY_NOT_FOUND);
        }
    });

    it('snapshot correctly captures object values', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 5 },
            { opcode: Opcode.SET_PROPERTY, name: 'n' },
            { opcode: Opcode.HALT },
        ];

        const { trace } = runVM(program);
        const snapshots = trace.snapshots;
        const postNewObj = snapshots[1]!;
        const objAddr = postNewObj.operandStack[0]!;
        expect(postNewObj.heap[objAddr]).toEqual({ type: 'object', properties: {} });

        const postSet = snapshots[5]!;
        const obj = postSet.heap['heap@0'] as ObjectValue;
        expect(obj.type).toBe('object');
        expect(obj.properties['n']).toBe('heap@1');
    });
});
