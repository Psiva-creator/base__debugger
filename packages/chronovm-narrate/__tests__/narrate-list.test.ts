import { describe, it, expect } from 'vitest';
import { Opcode, createInitialState, step } from 'chronovm-core';
import type { IRInstruction, VMState } from 'chronovm-core';
import { analyzeStep } from 'chronovm-analyze';
import { narrateStep } from 'chronovm-narrate';

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

function narrateAtStep(trace: VMState[], stepIdx: number): readonly string[] {
    const analysis = analyzeStep(trace, stepIdx);
    return narrateStep(analysis);
}

describe('List narration', () => {
    it('narrates ListCreated as "An empty list is created."', () => {
        const trace = buildTrace([
            { opcode: Opcode.NEW_LIST },
            { opcode: Opcode.STORE, name: 'lst' },
            { opcode: Opcode.HALT },
        ]);

        // trace[1] is state after NEW_LIST executed (step index 1)
        const sentences = narrateAtStep(trace, 1);
        expect(sentences.some(s => s.includes('empty list is created'))).toBe(true);
    });

    it('narrates ListAppended with variable and value', () => {
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

        // trace[5] is state after LIST_APPEND (step index 5)
        const sentences = narrateAtStep(trace, 5);
        expect(sentences.some(s => s.includes('appended to lst'))).toBe(true);
    });

    it('narrates ListIndexUpdated with variable, index, and value', () => {
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

        // trace[9] is state after LIST_SET (step index 9)
        const sentences = narrateAtStep(trace, 9);
        expect(sentences.some(s => s.includes('index 0') && s.includes('lst'))).toBe(true);
    });

    it('narration is deterministic across runs', () => {
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
            return JSON.stringify(narrateAtStep(trace, 5));
        });

        expect(runs[0]).toBe(runs[1]);
        expect(runs[1]).toBe(runs[2]);
    });
});
