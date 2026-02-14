import { describe, it, expect } from 'vitest';
import { Opcode, createInitialState, step, envLookup } from 'chronovm-core';
import type { IRInstruction, VMState, ListValue, HeapAddress } from 'chronovm-core';

function buildTrace(program: IRInstruction[]): VMState[] {
    const trace: VMState[] = [];
    let state = createInitialState(program);
    trace.push(state);
    while (state.isRunning) {
        state = step(state);
        trace.push(state);
    }
    return trace;
}

function getListValue(state: VMState, varName: string): ListValue {
    const addr = envLookup(state, state.currentEnvironment, varName);
    if (!addr) throw new Error(`Variable ${varName} not found`);
    const val = state.heap[addr];
    if (!val || typeof val !== 'object' || !('type' in val) || val.type !== 'list') {
        throw new Error(`Expected list, got ${JSON.stringify(val)}`);
    }
    return val as ListValue;
}

describe('NEW_LIST and LIST_APPEND', () => {
    it('NEW_LIST creates empty list on heap', () => {
        const trace = buildTrace([
            { opcode: Opcode.NEW_LIST },
            { opcode: Opcode.STORE, name: 'myList' },
            { opcode: Opcode.HALT },
        ]);

        const final = trace[trace.length - 1]!;
        const list = getListValue(final, 'myList');
        expect(list.type).toBe('list');
        expect(list.elements).toEqual([]);
    });

    it('LIST_APPEND increases elements length', () => {
        const trace = buildTrace([
            { opcode: Opcode.NEW_LIST },
            { opcode: Opcode.STORE, name: 'myList' },
            // Append value 10
            { opcode: Opcode.LOAD, name: 'myList' },
            { opcode: Opcode.LOAD_CONST, value: 10 },
            { opcode: Opcode.LIST_APPEND },
            // Append value 20
            { opcode: Opcode.LOAD, name: 'myList' },
            { opcode: Opcode.LOAD_CONST, value: 20 },
            { opcode: Opcode.LIST_APPEND },
            { opcode: Opcode.HALT },
        ]);

        const final = trace[trace.length - 1]!;
        const list = getListValue(final, 'myList');
        expect(list.elements.length).toBe(2);
        // Verify the actual values stored
        const val0 = final.heap[list.elements[0]!];
        const val1 = final.heap[list.elements[1]!];
        expect(val0).toBe(10);
        expect(val1).toBe(20);
    });

    it('LIST_APPEND preserves list identity (same address)', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_LIST },
            { opcode: Opcode.STORE, name: 'myList' },
            { opcode: Opcode.LOAD, name: 'myList' },
            { opcode: Opcode.LOAD_CONST, value: 42 },
            { opcode: Opcode.LIST_APPEND },
            { opcode: Opcode.HALT },
        ];

        const trace = buildTrace(program);
        const afterCreate = trace[2]!; // After STORE
        const final = trace[trace.length - 1]!;

        // Get the list address from both states
        const addrBefore = envLookup(afterCreate, afterCreate.currentEnvironment, 'myList')!;
        const addrAfter = envLookup(final, final.currentEnvironment, 'myList')!;

        // Identity preserved — same heap address
        expect(addrAfter).toBe(addrBefore);

        // But list has been updated immutably
        const listAfter = final.heap[addrAfter] as ListValue;
        expect(listAfter.elements.length).toBe(1);
    });

    it('shared reference sees mutation', () => {
        // Two variables pointing to the same list
        const trace = buildTrace([
            { opcode: Opcode.NEW_LIST },
            { opcode: Opcode.STORE, name: 'a' },
            { opcode: Opcode.LOAD, name: 'a' },
            { opcode: Opcode.STORE, name: 'b' },
            // Append via 'a'
            { opcode: Opcode.LOAD, name: 'a' },
            { opcode: Opcode.LOAD_CONST, value: 99 },
            { opcode: Opcode.LIST_APPEND },
            { opcode: Opcode.HALT },
        ]);

        const final = trace[trace.length - 1]!;
        const listA = getListValue(final, 'a');
        const listB = getListValue(final, 'b');

        // Both see the appended element (shared reference)
        expect(listA.elements.length).toBe(1);
        expect(listB.elements.length).toBe(1);
        expect(listA).toEqual(listB);
    });

    it('deterministic across 3 runs', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_LIST },
            { opcode: Opcode.STORE, name: 'lst' },
            { opcode: Opcode.LOAD, name: 'lst' },
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.LIST_APPEND },
            { opcode: Opcode.LOAD, name: 'lst' },
            { opcode: Opcode.LOAD_CONST, value: 2 },
            { opcode: Opcode.LIST_APPEND },
            { opcode: Opcode.HALT },
        ];

        const runs = Array.from({ length: 3 }, () => {
            const trace = buildTrace(program);
            return trace[trace.length - 1]!;
        });

        expect(runs[0]).toEqual(runs[1]);
        expect(runs[1]).toEqual(runs[2]);
    });
});

describe('LIST_GET and LIST_SET', () => {
    it('LIST_GET reads element by index', () => {
        const trace = buildTrace([
            { opcode: Opcode.NEW_LIST },
            { opcode: Opcode.STORE, name: 'lst' },
            // Append 10, 20, 30
            { opcode: Opcode.LOAD, name: 'lst' },
            { opcode: Opcode.LOAD_CONST, value: 10 },
            { opcode: Opcode.LIST_APPEND },
            { opcode: Opcode.LOAD, name: 'lst' },
            { opcode: Opcode.LOAD_CONST, value: 20 },
            { opcode: Opcode.LIST_APPEND },
            { opcode: Opcode.LOAD, name: 'lst' },
            { opcode: Opcode.LOAD_CONST, value: 30 },
            { opcode: Opcode.LIST_APPEND },
            // Get index 1 → should be 20
            { opcode: Opcode.LOAD, name: 'lst' },
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.LIST_GET },
            { opcode: Opcode.STORE, name: 'result' },
            { opcode: Opcode.HALT },
        ]);

        const final = trace[trace.length - 1]!;
        const addr = envLookup(final, final.currentEnvironment, 'result')!;
        expect(final.heap[addr]).toBe(20);
    });

    it('LIST_SET updates element by index', () => {
        const trace = buildTrace([
            { opcode: Opcode.NEW_LIST },
            { opcode: Opcode.STORE, name: 'lst' },
            // Append 10, 20
            { opcode: Opcode.LOAD, name: 'lst' },
            { opcode: Opcode.LOAD_CONST, value: 10 },
            { opcode: Opcode.LIST_APPEND },
            { opcode: Opcode.LOAD, name: 'lst' },
            { opcode: Opcode.LOAD_CONST, value: 20 },
            { opcode: Opcode.LIST_APPEND },
            // Set index 0 → 99
            { opcode: Opcode.LOAD, name: 'lst' },
            { opcode: Opcode.LOAD_CONST, value: 0 },
            { opcode: Opcode.LOAD_CONST, value: 99 },
            { opcode: Opcode.LIST_SET },
            { opcode: Opcode.HALT },
        ]);

        const final = trace[trace.length - 1]!;
        const list = getListValue(final, 'lst');
        expect(list.elements.length).toBe(2);
        expect(final.heap[list.elements[0]!]).toBe(99);
        expect(final.heap[list.elements[1]!]).toBe(20);
    });

    it('LIST_GET throws on out-of-bounds index', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_LIST },
            { opcode: Opcode.STORE, name: 'lst' },
            // Try to get index 0 from empty list
            { opcode: Opcode.LOAD, name: 'lst' },
            { opcode: Opcode.LOAD_CONST, value: 0 },
            { opcode: Opcode.LIST_GET },
            { opcode: Opcode.HALT },
        ];

        expect(() => buildTrace(program)).toThrow(/out of bounds/);
    });

    it('LIST_SET throws on out-of-bounds index', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_LIST },
            { opcode: Opcode.STORE, name: 'lst' },
            // Try to set index 5 on empty list
            { opcode: Opcode.LOAD, name: 'lst' },
            { opcode: Opcode.LOAD_CONST, value: 5 },
            { opcode: Opcode.LOAD_CONST, value: 42 },
            { opcode: Opcode.LIST_SET },
            { opcode: Opcode.HALT },
        ];

        expect(() => buildTrace(program)).toThrow(/out of bounds/);
    });
});
