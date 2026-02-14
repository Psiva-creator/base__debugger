import { describe, it, expect } from 'vitest';
import { Opcode, createInitialState, step } from 'chronovm-core';
import type { IRInstruction, VMState } from 'chronovm-core';
import { buildMemoryModel, diffMemoryModels } from 'chronovm-model';
import { buildMemoryGraph } from 'chronovm-graph';
import { explainDiff } from 'chronovm-explain';
import type { ExplanationEvent } from 'chronovm-explain';

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

function explainStep(trace: VMState[], stepIdx: number): readonly ExplanationEvent[] {
    const before = buildMemoryModel(trace[stepIdx]!);
    const after = buildMemoryModel(trace[stepIdx + 1]!);
    const diff = diffMemoryModels(before, after);
    const graphBefore = buildMemoryGraph(before);
    const graphAfter = buildMemoryGraph(after);
    return explainDiff(diff, graphBefore, graphAfter);
}

describe('List explanation events', () => {
    it('detects ListCreated on NEW_LIST', () => {
        const trace = buildTrace([
            { opcode: Opcode.NEW_LIST },
            { opcode: Opcode.STORE, name: 'lst' },
            { opcode: Opcode.HALT },
        ]);

        // Step 0: NEW_LIST
        const events = explainStep(trace, 0);
        const listCreated = events.filter((e) => e.type === 'ListCreated');
        expect(listCreated.length).toBe(1);
    });

    it('detects ListAppended on LIST_APPEND', () => {
        const trace = buildTrace([
            // 0: NEW_LIST
            { opcode: Opcode.NEW_LIST },
            // 1: STORE
            { opcode: Opcode.STORE, name: 'lst' },
            // 2: LOAD
            { opcode: Opcode.LOAD, name: 'lst' },
            // 3: LOAD_CONST 10
            { opcode: Opcode.LOAD_CONST, value: 10 },
            // 4: LIST_APPEND
            { opcode: Opcode.LIST_APPEND },
            // 5: HALT
            { opcode: Opcode.HALT },
        ]);

        // Step 4: LIST_APPEND
        const events = explainStep(trace, 4);
        const appended = events.filter((e) => e.type === 'ListAppended');
        expect(appended.length).toBe(1);
    });

    it('detects ListIndexUpdated on LIST_SET', () => {
        const trace = buildTrace([
            // 0: NEW_LIST
            { opcode: Opcode.NEW_LIST },
            // 1: STORE
            { opcode: Opcode.STORE, name: 'lst' },
            // 2: LOAD
            { opcode: Opcode.LOAD, name: 'lst' },
            // 3: LOAD_CONST 10
            { opcode: Opcode.LOAD_CONST, value: 10 },
            // 4: LIST_APPEND
            { opcode: Opcode.LIST_APPEND },
            // 5: LOAD
            { opcode: Opcode.LOAD, name: 'lst' },
            // 6: LOAD_CONST 0
            { opcode: Opcode.LOAD_CONST, value: 0 },
            // 7: LOAD_CONST 99
            { opcode: Opcode.LOAD_CONST, value: 99 },
            // 8: LIST_SET
            { opcode: Opcode.LIST_SET },
            // 9: HALT
            { opcode: Opcode.HALT },
        ]);

        // Step 8: LIST_SET
        const events = explainStep(trace, 8);
        const updated = events.filter((e) => e.type === 'ListIndexUpdated');
        expect(updated.length).toBe(1);
        if (updated[0]!.type === 'ListIndexUpdated') {
            expect(updated[0]!.index).toBe(0);
        }
    });

    it('events are deterministic across runs', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_LIST },
            { opcode: Opcode.STORE, name: 'lst' },
            { opcode: Opcode.LOAD, name: 'lst' },
            { opcode: Opcode.LOAD_CONST, value: 42 },
            { opcode: Opcode.LIST_APPEND },
            { opcode: Opcode.HALT },
        ];

        const runs = Array.from({ length: 3 }, () => {
            const trace = buildTrace(program);
            return JSON.stringify(explainStep(trace, 4));
        });

        expect(runs[0]).toBe(runs[1]);
        expect(runs[1]).toBe(runs[2]);
    });
});
