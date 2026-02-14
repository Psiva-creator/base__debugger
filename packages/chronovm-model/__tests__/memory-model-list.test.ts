import { describe, it, expect } from 'vitest';
import { Opcode, createInitialState, step } from 'chronovm-core';
import type { IRInstruction, VMState } from 'chronovm-core';
import { buildMemoryModel, diffMemoryModels } from 'chronovm-model';
import type { ListNode } from 'chronovm-model';

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

describe('Memory model — list support', () => {
    it('NEW_LIST produces a list HeapNode with empty elements', () => {
        const trace = buildTrace([
            { opcode: Opcode.NEW_LIST },
            { opcode: Opcode.STORE, name: 'lst' },
            { opcode: Opcode.HALT },
        ]);

        const model = buildMemoryModel(trace[trace.length - 1]!);
        const listNode = model.heapNodes.find((n) => n.kind === 'list') as ListNode | undefined;

        expect(listNode).toBeDefined();
        expect(listNode!.kind).toBe('list');
        expect(listNode!.elements).toEqual([]);
    });

    it('LIST_APPEND produces elements with ascending indices', () => {
        const trace = buildTrace([
            { opcode: Opcode.NEW_LIST },
            { opcode: Opcode.STORE, name: 'lst' },
            { opcode: Opcode.LOAD, name: 'lst' },
            { opcode: Opcode.LOAD_CONST, value: 10 },
            { opcode: Opcode.LIST_APPEND },
            { opcode: Opcode.LOAD, name: 'lst' },
            { opcode: Opcode.LOAD_CONST, value: 20 },
            { opcode: Opcode.LIST_APPEND },
            { opcode: Opcode.HALT },
        ]);

        const model = buildMemoryModel(trace[trace.length - 1]!);
        const listNode = model.heapNodes.find((n) => n.kind === 'list') as ListNode;

        expect(listNode.elements.length).toBe(2);
        expect(listNode.elements[0]!.index).toBe(0);
        expect(listNode.elements[1]!.index).toBe(1);
        // Indices are ascending
        for (let i = 1; i < listNode.elements.length; i++) {
            expect(listNode.elements[i]!.index).toBeGreaterThan(listNode.elements[i - 1]!.index);
        }
    });

    it('diffMemoryModels detects list changes', () => {
        const trace = buildTrace([
            // 0: NEW_LIST
            { opcode: Opcode.NEW_LIST },
            // 1: STORE
            { opcode: Opcode.STORE, name: 'lst' },
            // 2: LOAD lst
            { opcode: Opcode.LOAD, name: 'lst' },
            // 3: LOAD_CONST 42
            { opcode: Opcode.LOAD_CONST, value: 42 },
            // 4: LIST_APPEND
            { opcode: Opcode.LIST_APPEND },
            // 5: HALT
            { opcode: Opcode.HALT },
        ]);

        // trace[4] = state before LIST_APPEND, trace[5] = state after LIST_APPEND
        const beforeAppend = buildMemoryModel(trace[4]!);
        const afterAppend = buildMemoryModel(trace[5]!);

        const diff = diffMemoryModels(beforeAppend, afterAppend);
        // The list node should show as changed (elements updated)
        expect(diff.changedHeapNodes.length).toBeGreaterThan(0);
    });

    it('JSON.stringify is deterministic across runs', () => {
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
            return JSON.stringify(buildMemoryModel(trace[trace.length - 1]!));
        });

        expect(runs[0]).toBe(runs[1]);
        expect(runs[1]).toBe(runs[2]);
    });
});
