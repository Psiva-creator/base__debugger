import { describe, it, expect } from 'vitest';
import { runVM, Opcode, step, createInitialState } from 'chronovm-core';
import type { IRInstruction } from 'chronovm-core';
import { buildMemoryModel, diffMemoryModels } from 'chronovm-model';
import { buildMemoryGraph } from 'chronovm-graph';
import { explainDiff } from '../src/index.ts';
import type { ExplanationEvent, VariableBoundEvent, VariableReboundEvent } from '../src/index.ts';

function stateAfterSteps(program: IRInstruction[], steps: number) {
    let state = createInitialState(program);
    for (let i = 0; i < steps && state.isRunning; i++) {
        state = step(state);
    }
    return state;
}

function explainBetweenSteps(program: IRInstruction[], stepA: number, stepB: number) {
    const sA = stateAfterSteps(program, stepA);
    const sB = stateAfterSteps(program, stepB);
    const mA = buildMemoryModel(sA);
    const mB = buildMemoryModel(sB);
    const diff = diffMemoryModels(mA, mB);
    const gA = buildMemoryGraph(mA);
    const gB = buildMemoryGraph(mB);
    return explainDiff(diff, gA, gB);
}

describe('Explanation Events', () => {
    it('VariableBound includes address on x=2', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 2 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.HALT },
        ];

        const events = explainBetweenSteps(program, 0, 2);
        const bound = events.filter((e) => e.type === 'VariableBound') as VariableBoundEvent[];
        expect(bound.length).toBe(1);
        expect(bound[0]!.name).toBe('x');
        expect(bound[0]!.address).toBe('heap@0');
    });

    it('ObjectAllocated on NEW_OBJECT', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.HALT },
        ];

        const events = explainBetweenSteps(program, 0, 1);
        const alloc = events.filter((e) => e.type === 'ObjectAllocated');
        expect(alloc.length).toBe(1);
        expect((alloc[0] as { kind: string }).kind).toBe('object');
    });

    it('PropertyAdded on SET_PROPERTY', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 10 },
            { opcode: Opcode.SET_PROPERTY, name: 'x' },
            { opcode: Opcode.HALT },
        ];

        const events = explainBetweenSteps(program, 2, 5);
        const propEvents = events.filter((e) => e.type === 'PropertyAdded');
        expect(propEvents.length).toBe(1);
        expect((propEvents[0] as { property: string }).property).toBe('x');
    });

    it('ClosureCaptured on MAKE_FUNCTION', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 5 },
            { opcode: Opcode.STORE, name: 'val' },
            { opcode: Opcode.MAKE_FUNCTION, entry: 5 },
            { opcode: Opcode.STORE, name: 'fn' },
            { opcode: Opcode.HALT },
            { opcode: Opcode.LOAD, name: 'val' },
            { opcode: Opcode.RET },
        ];

        const events = explainBetweenSteps(program, 2, 3);
        const closure = events.filter((e) => e.type === 'ClosureCaptured');
        expect(closure.length).toBe(1);
        expect((closure[0] as { function: string }).function).toMatch(/^heap@/);
        expect((closure[0] as { environment: string }).environment).toMatch(/^env@/);
    });

    it('VariableRebound includes from/to on reassignment', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.LOAD_CONST, value: 2 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.HALT },
        ];

        const events = explainBetweenSteps(program, 2, 4);
        const rebound = events.filter((e) => e.type === 'VariableRebound') as VariableReboundEvent[];
        expect(rebound.length).toBe(1);
        expect(rebound[0]!.name).toBe('x');
        expect(rebound[0]!.from).toBe('heap@0');
        expect(rebound[0]!.to).toBe('heap@1');
    });

    it('deterministic sorted output across 3 runs', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.SET_PROPERTY, name: 'a' },
            { opcode: Opcode.HALT },
        ];

        const runs = Array.from({ length: 3 }, () =>
            explainBetweenSteps(program, 0, 5),
        );
        expect(runs[0]).toEqual(runs[1]);
        expect(runs[1]).toEqual(runs[2]);
    });

    it('events are sorted by type then content', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.SET_PROPERTY, name: 'a' },
            { opcode: Opcode.HALT },
        ];

        const events = explainBetweenSteps(program, 0, 5);
        const types = events.map((e) => e.type);
        const sorted = [...types].sort();
        expect(types).toEqual(sorted);
    });

    it('ObjectCollected after GC removes node', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'trash' },
            { opcode: Opcode.LOAD_CONST, value: 0 },
            { opcode: Opcode.STORE, name: 'trash' },
            { opcode: Opcode.HALT },
        ];

        const withoutGC = runVM(program);
        const withGC = runVM(program, { gc: true });
        const mBefore = buildMemoryModel(withoutGC.finalState);
        const mAfter = buildMemoryModel(withGC.finalState);
        const diff = diffMemoryModels(mBefore, mAfter);
        const gBefore = buildMemoryGraph(mBefore);
        const gAfter = buildMemoryGraph(mAfter);
        const events = explainDiff(diff, gBefore, gAfter);

        const collected = events.filter((e) => e.type === 'ObjectCollected');
        expect(collected.length).toBeGreaterThan(0);
    });
});
