import { describe, it, expect } from 'vitest';
import { Opcode, createInitialState, step } from 'chronovm-core';
import type { IRInstruction, VMState } from 'chronovm-core';
import { analyzeStep } from 'chronovm-analyze';
import type { StepAnalysis } from 'chronovm-analyze';
import { narrateStep } from '../src/index.ts';

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

describe('narrateStep', () => {
    it('x=2 produces correct sentence', () => {
        const trace = buildTrace([
            { opcode: Opcode.LOAD_CONST, value: 2 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.HALT },
        ]);

        const analysis = analyzeStep(trace, 2);
        const sentences = narrateStep(analysis);
        expect(sentences).toContain('The value 2 is stored in variable x.');
    });

    it('reassignment produces update sentence', () => {
        const trace = buildTrace([
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.LOAD_CONST, value: 2 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.HALT },
        ]);

        const analysis = analyzeStep(trace, 4);
        const sentences = narrateStep(analysis);
        expect(sentences).toContain('Variable x is updated to 2.');
    });

    it('object creation sentence', () => {
        const trace = buildTrace([
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.HALT },
        ]);

        const analysis = analyzeStep(trace, 1);
        const sentences = narrateStep(analysis);
        expect(sentences).toContain('A new object is created.');
    });

    it('property set sentence with value', () => {
        const trace = buildTrace([
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 10 },
            { opcode: Opcode.SET_PROPERTY, name: 'a' },
            { opcode: Opcode.HALT },
        ]);

        const analysis = analyzeStep(trace, 5);
        const sentences = narrateStep(analysis);
        expect(sentences).toContain("The property 'a' of obj is set to 10.");
    });

    it('closure sentence', () => {
        const trace = buildTrace([
            { opcode: Opcode.LOAD_CONST, value: 5 },
            { opcode: Opcode.STORE, name: 'val' },
            { opcode: Opcode.MAKE_FUNCTION, entry: 5 },
            { opcode: Opcode.STORE, name: 'fn' },
            { opcode: Opcode.HALT },
            { opcode: Opcode.LOAD, name: 'val' },
            { opcode: Opcode.RET },
        ]);

        const analysis = analyzeStep(trace, 3);
        const sentences = narrateStep(analysis);
        expect(sentences).toContain(
            'A function is created that remembers variables from its surrounding scope.',
        );
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

        const runs = Array.from({ length: 3 }, () => {
            const trace = buildTrace(program);
            return narrateStep(analyzeStep(trace, 5));
        });
        expect(runs[0]).toEqual(runs[1]);
        expect(runs[1]).toEqual(runs[2]);
    });

    it('no heap addresses in output', () => {
        const trace = buildTrace([
            { opcode: Opcode.LOAD_CONST, value: 42 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.HALT },
        ]);

        for (let i = 0; i < trace.length; i++) {
            const sentences = narrateStep(analyzeStep(trace, i));
            for (const s of sentences) {
                expect(s).not.toMatch(/heap@/);
                expect(s).not.toMatch(/env@/);
            }
        }
    });

    it('environment created sentence on function call', () => {
        const trace = buildTrace([
            { opcode: Opcode.MAKE_FUNCTION, entry: 5 },
            { opcode: Opcode.STORE, name: 'fn' },
            { opcode: Opcode.LOAD, name: 'fn' },
            { opcode: Opcode.CALL, argCount: 0 },
            { opcode: Opcode.HALT },
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.RET },
        ]);

        const callStep = 4;
        const analysis = analyzeStep(trace, callStep);
        const sentences = narrateStep(analysis);
        expect(sentences).toContain('A new scope is created.');
    });

    it('environment destroyed sentence on return', () => {
        const analysis: StepAnalysis = {
            step: 1,
            memoryModel: {
                heapNodes: [],
                environments: [],
                operandStack: [],
                currentEnvironment: 'env@0',
                globalEnvironment: 'env@0',
            },
            graph: { nodes: [], edges: [] },
            diffFromPrevious: null,
            events: [{ type: 'EnvironmentDestroyed', address: 'env@1' }],
            insights: [],
            plans: [],
        };

        const sentences = narrateStep(analysis);
        expect(sentences).toContain('The current scope is exited.');
    });

    it('variable unbound sentence', () => {
        const analysis: StepAnalysis = {
            step: 1,
            memoryModel: {
                heapNodes: [],
                environments: [],
                operandStack: [],
                currentEnvironment: 'env@0',
                globalEnvironment: 'env@0',
            },
            graph: { nodes: [], edges: [] },
            diffFromPrevious: null,
            events: [{ type: 'VariableUnbound', env: 'env@0', name: 'temp', address: 'heap@5' }],
            insights: [],
            plans: [],
        };

        const sentences = narrateStep(analysis);
        expect(sentences).toContain('Variable temp is removed.');
    });

    it('property removed sentence', () => {
        const analysis: StepAnalysis = {
            step: 1,
            memoryModel: {
                heapNodes: [
                    { kind: 'object', address: 'heap@1', properties: [] },
                ],
                environments: [
                    {
                        address: 'env@0',
                        parent: null,
                        bindings: [{ name: 'obj', address: 'heap@1' }],
                    },
                ],
                operandStack: [],
                currentEnvironment: 'env@0',
                globalEnvironment: 'env@0',
            },
            graph: { nodes: [], edges: [] },
            diffFromPrevious: null,
            events: [{ type: 'PropertyRemoved', object: 'heap@1', property: 'x' }],
            insights: [],
            plans: [],
        };

        const sentences = narrateStep(analysis);
        expect(sentences).toContain("The property 'x' of obj is removed.");
    });

    it('property removed without variable reference', () => {
        const analysis: StepAnalysis = {
            step: 1,
            memoryModel: {
                heapNodes: [
                    { kind: 'object', address: 'heap@1', properties: [] },
                ],
                environments: [],
                operandStack: [],
                currentEnvironment: 'env@0',
                globalEnvironment: 'env@0',
            },
            graph: { nodes: [], edges: [] },
            diffFromPrevious: null,
            events: [{ type: 'PropertyRemoved', object: 'heap@1', property: 'y' }],
            insights: [],
            plans: [],
        };

        const sentences = narrateStep(analysis);
        expect(sentences).toContain("The property 'y' is removed from the object.");
    });

    it('determinism across 3 runs with all event types', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 10 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'x' },
            { opcode: Opcode.SET_PROPERTY, name: 'a' },
            { opcode: Opcode.MAKE_FUNCTION, entry: 11 },
            { opcode: Opcode.STORE, name: 'fn' },
            { opcode: Opcode.LOAD, name: 'fn' },
            { opcode: Opcode.CALL, argCount: 0 },
            { opcode: Opcode.HALT },
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.RET },
        ];

        const runs = Array.from({ length: 3 }, () => {
            const trace = buildTrace(program);
            const allSentences: string[][] = [];
            for (let i = 0; i < trace.length; i++) {
                allSentences.push([...narrateStep(analyzeStep(trace, i))]);
            }
            return allSentences;
        });

        expect(runs[0]).toEqual(runs[1]);
        expect(runs[1]).toEqual(runs[2]);
    });
});
