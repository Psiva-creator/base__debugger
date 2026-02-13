import { describe, it, expect } from 'vitest';
import { runVM, Opcode } from 'chronovm-core';
import type { IRInstruction } from 'chronovm-core';
import { buildMemoryModel } from 'chronovm-model';
import { buildMemoryGraph } from '../src/index.ts';

function graphFor(program: IRInstruction[]) {
    const { finalState } = runVM(program);
    return buildMemoryGraph(buildMemoryModel(finalState));
}

describe('Memory Graph', () => {
    it('x=2 produces one env node + one primitive node', () => {
        const graph = graphFor([
            { opcode: Opcode.LOAD_CONST, value: 2 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.HALT },
        ]);

        const envNodes = graph.nodes.filter((n) => n.kind === 'environment');
        const primNodes = graph.nodes.filter((n) => n.kind === 'primitive');
        expect(envNodes.length).toBe(1);
        expect(primNodes.length).toBe(1);
        expect(primNodes[0]!.label).toBe('2');
    });

    it('object graph edges correct', () => {
        const graph = graphFor([
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 10 },
            { opcode: Opcode.SET_PROPERTY, name: 'x' },
            { opcode: Opcode.HALT },
        ]);

        const objEdges = graph.edges.filter((e) => e.from === 'heap@0');
        expect(objEdges).toEqual([{ from: 'heap@0', to: 'heap@1', label: 'x' }]);
    });

    it('closure edge present', () => {
        const graph = graphFor([
            { opcode: Opcode.LOAD_CONST, value: 5 },
            { opcode: Opcode.STORE, name: 'val' },
            { opcode: Opcode.MAKE_FUNCTION, entry: 5 },
            { opcode: Opcode.STORE, name: 'fn' },
            { opcode: Opcode.HALT },
            { opcode: Opcode.LOAD, name: 'val' },
            { opcode: Opcode.RET },
        ]);

        const closureEdges = graph.edges.filter((e) => e.label === 'closure');
        expect(closureEdges.length).toBe(1);
        expect(closureEdges[0]!.from).toMatch(/^heap@/);
        expect(closureEdges[0]!.to).toMatch(/^env@/);
    });

    it('nested objects produce correct edges', () => {
        const graph = graphFor([
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'inner' },
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'outer' },
            { opcode: Opcode.LOAD, name: 'outer' },
            { opcode: Opcode.LOAD, name: 'inner' },
            { opcode: Opcode.SET_PROPERTY, name: 'child' },
            { opcode: Opcode.HALT },
        ]);

        const outerEdges = graph.edges.filter(
            (e) => e.from === 'heap@1' && e.label === 'child',
        );
        expect(outerEdges).toEqual([
            { from: 'heap@1', to: 'heap@0', label: 'child' },
        ]);
    });

    it('deterministic ordering across 3 runs', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.SET_PROPERTY, name: 'a' },
            { opcode: Opcode.MAKE_FUNCTION, entry: 8 },
            { opcode: Opcode.STORE, name: 'fn' },
            { opcode: Opcode.HALT },
            { opcode: Opcode.RET },
        ];

        const graphs = Array.from({ length: 3 }, () => graphFor(program));
        expect(graphs[0]).toEqual(graphs[1]);
        expect(graphs[1]).toEqual(graphs[2]);
    });

    it('graph identical for identical MemoryModel', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 7 },
            { opcode: Opcode.STORE, name: 'n' },
            { opcode: Opcode.HALT },
        ];

        const { finalState: s1 } = runVM(program);
        const { finalState: s2 } = runVM(program);
        const g1 = buildMemoryGraph(buildMemoryModel(s1));
        const g2 = buildMemoryGraph(buildMemoryModel(s2));
        expect(g1).toEqual(g2);
    });

    it('no duplicate nodes', () => {
        const graph = graphFor([
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'a' },
            { opcode: Opcode.LOAD, name: 'a' },
            { opcode: Opcode.STORE, name: 'b' },
            { opcode: Opcode.HALT },
        ]);

        const ids = graph.nodes.map((n) => n.id);
        expect(ids.length).toBe(new Set(ids).size);
    });

    it('no duplicate edges', () => {
        const graph = graphFor([
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: 'obj' },
            { opcode: Opcode.LOAD, name: 'obj' },
            { opcode: Opcode.LOAD_CONST, value: 1 },
            { opcode: Opcode.SET_PROPERTY, name: 'x' },
            { opcode: Opcode.HALT },
        ]);

        const keys = graph.edges.map((e) => `${e.from}|${e.to}|${e.label}`);
        expect(keys.length).toBe(new Set(keys).size);
    });
});
