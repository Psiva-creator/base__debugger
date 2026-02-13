import { describe, it, expect } from 'vitest';
import { Opcode, createInitialState, step } from 'chronovm-core';
import type { IRInstruction, VMState } from 'chronovm-core';
import { analyzeStep } from '../src/index.ts';

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

describe('analyzeStep', () => {
    it('step 0 returns null diff and empty arrays', () => {
        const trace = buildTrace([
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.HALT },
        ]);

        const result = analyzeStep(trace, 0);
        expect(result.step).toBe(0);
        expect(result.diffFromPrevious).toBeNull();
        expect(result.events).toEqual([]);
        expect(result.insights).toEqual([]);
        expect(result.plans).toEqual([]);
        expect(result.memoryModel).toBeDefined();
        expect(result.graph).toBeDefined();
    });

    it('step 1 produces events', () => {
        const trace = buildTrace([
            { opcode: Opcode.LOAD_CONST, value: 42 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.HALT },
        ]);

        const result = analyzeStep(trace, 2);
        expect(result.step).toBe(2);
        expect(result.diffFromPrevious).not.toBeNull();
        expect(result.events.length).toBeGreaterThan(0);
    });

    it('deterministic across 3 runs', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.SET_PROPERTY, name: 'a' },
            { opcode: Opcode.HALT },
        ];

        const traces = Array.from({ length: 3 }, () => buildTrace(program));
        const results = traces.map((t) => analyzeStep(t, 2));
        expect(results[0]).toEqual(results[1]);
        expect(results[1]).toEqual(results[2]);
    });

    it('output structure has all required fields', () => {
        const trace = buildTrace([
            { opcode: Opcode.LOAD_CONST, value: 5 },
            { opcode: Opcode.STORE, name: 'n' },
            { opcode: Opcode.HALT },
        ]);

        const result = analyzeStep(trace, 1);
        expect(result).toHaveProperty('step');
        expect(result).toHaveProperty('memoryModel');
        expect(result).toHaveProperty('graph');
        expect(result).toHaveProperty('diffFromPrevious');
        expect(result).toHaveProperty('events');
        expect(result).toHaveProperty('insights');
        expect(result).toHaveProperty('plans');
        expect(result.graph.nodes).toBeDefined();
        expect(result.graph.edges).toBeDefined();
    });

    it('full pipeline integration: closure produces ClosureBehavior plan', () => {
        const trace = buildTrace([
            { opcode: Opcode.LOAD_CONST, value: 5 },
            { opcode: Opcode.STORE, name: 'val' },
            { opcode: Opcode.MAKE_FUNCTION, entry: 5 },
            { opcode: Opcode.STORE, name: 'fn' },
            { opcode: Opcode.HALT },
            { opcode: Opcode.LOAD, name: 'val' },
            { opcode: Opcode.RET },
        ]);

        const result = analyzeStep(trace, 3);
        const closureEvents = result.events.filter((e) => e.type === 'ClosureCaptured');
        expect(closureEvents.length).toBe(1);

        const closureInsights = result.insights.filter(
            (i) => i.type === 'ClosureRetainsEnvironment',
        );
        expect(closureInsights.length).toBe(1);

        const closurePlans = result.plans.filter(
            (p) => p.category === 'ClosureBehavior',
        );
        expect(closurePlans.length).toBe(1);
        expect(closurePlans[0]!.key).toBe('ClosureCapture');
    });

    it('throws on out-of-bounds stepIndex', () => {
        const trace = buildTrace([{ opcode: Opcode.HALT }]);
        expect(() => analyzeStep(trace, -1)).toThrow(RangeError);
        expect(() => analyzeStep(trace, 999)).toThrow(RangeError);
    });
});
