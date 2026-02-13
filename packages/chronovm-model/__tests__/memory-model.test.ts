import { describe, it, expect } from 'vitest';
import { runVM, Opcode, step, createInitialState } from 'chronovm-core';
import type { IRInstruction } from 'chronovm-core';
import { buildMemoryModel, diffMemoryModels } from '../src/index.ts';
import type { PrimitiveNode, ObjectNode, FunctionNode } from '../src/index.ts';

function runNTimes(program: readonly IRInstruction[], n: number) {
    return Array.from({ length: n }, () => {
        const { finalState } = runVM(program);
        return buildMemoryModel(finalState);
    });
}

describe('Memory Model', () => {
    it('maps x=2 correctly', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 2 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program);
        const model = buildMemoryModel(finalState);

        expect(model.heapNodes.length).toBe(1);
        const node = model.heapNodes[0]! as PrimitiveNode;
        expect(node.kind).toBe('primitive');
        expect(node.value).toBe(2);
        expect(node.address).toBe('heap@0');

        expect(model.environments.length).toBe(1);
        const env = model.environments[0]!;
        expect(env.bindings).toEqual([{ name: 'x', address: 'heap@0' }]);
    });

    it('maps object correctly', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 10 },
            { opcode: Opcode.SET_PROPERTY, name: 'a' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 20 },
            { opcode: Opcode.SET_PROPERTY, name: 'b' },
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program);
        const model = buildMemoryModel(finalState);

        const objNode = model.heapNodes.find(
            (n) => n.kind === 'object',
        ) as ObjectNode;
        expect(objNode).toBeDefined();
        expect(objNode.properties.map((p) => p.key)).toEqual(['a', 'b']);
    });

    it('maps closure environment correctly', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 5 },
            { opcode: Opcode.STORE, name: 'captured' },
            { opcode: Opcode.MAKE_FUNCTION, entry: 5 },
            { opcode: Opcode.STORE, name: 'fn' },
            { opcode: Opcode.HALT },
            { opcode: Opcode.LOAD, name: 'captured' },
            { opcode: Opcode.RET },
        ];

        const { finalState } = runVM(program);
        const model = buildMemoryModel(finalState);

        const fnNode = model.heapNodes.find(
            (n) => n.kind === 'function',
        ) as FunctionNode;
        expect(fnNode).toBeDefined();
        expect(fnNode.entry).toBe(5);
        expect(fnNode.environment).toBe('env@0');
    });

    it('sorts heap nodes and bindings deterministically', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 3 },
            { opcode: Opcode.STORE, name: 'z' },
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.STORE, name: 'a' },
            { opcode: Opcode.LOAD_CONST, value: 2 },
            { opcode: Opcode.STORE, name: 'm' },
            { opcode: Opcode.HALT },
        ];

        const { finalState } = runVM(program);
        const model = buildMemoryModel(finalState);

        const addresses = model.heapNodes.map((n) => n.address);
        expect(addresses).toEqual([...addresses].sort());

        const env = model.environments[0]!;
        const names = env.bindings.map((b) => b.name);
        expect(names).toEqual(['a', 'm', 'z']);
    });

    it('diffs models correctly', () => {
        const prog1: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.HALT },
        ];

        const prog2: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.LOAD_CONST, value: 2 },
            { opcode: Opcode.STORE, name: 'y' },
            { opcode: Opcode.HALT },
        ];

        const model1 = buildMemoryModel(runVM(prog1).finalState);
        const model2 = buildMemoryModel(runVM(prog2).finalState);

        const diff = diffMemoryModels(model1, model2);
        expect(diff.addedHeapNodes).toContain('heap@1');
        expect(diff.removedHeapNodes).toEqual([]);
        expect(diff.addedBindings).toEqual([{ env: 'env@0', name: 'y' }]);
    });

    it('diff detects changed heap nodes', () => {
        const state1 = createInitialState([
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.HALT },
        ]);
        let s = state1;
        while (s.isRunning) s = step(s);
        const model1 = buildMemoryModel(s);

        const state2 = createInitialState([
            { opcode: Opcode.LOAD_CONST, value: 99 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.HALT },
        ]);
        let s2 = state2;
        while (s2.isRunning) s2 = step(s2);
        const model2 = buildMemoryModel(s2);

        const diff = diffMemoryModels(model1, model2);
        expect(diff.changedHeapNodes).toContain('heap@0');
    });

    it('produces identical model across 3 runs', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 42 },
            { opcode: Opcode.SET_PROPERTY, name: 'x' },
            { opcode: Opcode.MAKE_FUNCTION, entry: 8 },
            { opcode: Opcode.STORE, name: 'fn' },
            { opcode: Opcode.HALT },
            { opcode: Opcode.RET },
        ];

        const models = runNTimes(program, 3);

        expect(models[0]).toEqual(models[1]);
        expect(models[1]).toEqual(models[2]);
    });
});
