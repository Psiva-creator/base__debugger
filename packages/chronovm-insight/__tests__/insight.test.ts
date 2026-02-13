import { describe, it, expect } from 'vitest';
import type { ExplanationEvent } from 'chronovm-explain';
import { analyzeEvents } from '../src/index.ts';
import type { RepeatedRebinding, ObjectAllocatedAndCollected, ClosureRetainsEnvironment, PropertyMutatedAfterAllocation } from '../src/index.ts';

describe('Insights', () => {
    it('detects repeated rebinding', () => {
        const events: ExplanationEvent[] = [
            { type: 'VariableRebound', env: 'env@0', name: 'x', from: 'heap@0', to: 'heap@1' },
            { type: 'VariableRebound', env: 'env@0', name: 'x', from: 'heap@1', to: 'heap@2' },
            { type: 'VariableRebound', env: 'env@0', name: 'x', from: 'heap@2', to: 'heap@3' },
        ];

        const insights = analyzeEvents(events);
        const rebind = insights.filter((i) => i.type === 'RepeatedRebinding') as RepeatedRebinding[];
        expect(rebind.length).toBe(1);
        expect(rebind[0]!.variable).toBe('x');
        expect(rebind[0]!.count).toBe(3);
    });

    it('detects object allocated and collected', () => {
        const events: ExplanationEvent[] = [
            { type: 'ObjectAllocated', address: 'heap@0', kind: 'object' },
            { type: 'ObjectAllocated', address: 'heap@1', kind: 'primitive' },
            { type: 'ObjectCollected', address: 'heap@0', kind: 'object' },
        ];

        const insights = analyzeEvents(events);
        const allcol = insights.filter((i) => i.type === 'ObjectAllocatedAndCollected') as ObjectAllocatedAndCollected[];
        expect(allcol.length).toBe(1);
        expect(allcol[0]!.address).toBe('heap@0');
    });

    it('detects closure retains environment', () => {
        const events: ExplanationEvent[] = [
            { type: 'ClosureCaptured', function: 'heap@1', environment: 'env@0' },
        ];

        const insights = analyzeEvents(events);
        const closure = insights.filter((i) => i.type === 'ClosureRetainsEnvironment') as ClosureRetainsEnvironment[];
        expect(closure.length).toBe(1);
        expect(closure[0]!.function).toBe('heap@1');
        expect(closure[0]!.environment).toBe('env@0');
    });

    it('detects property mutated after allocation', () => {
        const events: ExplanationEvent[] = [
            { type: 'ObjectAllocated', address: 'heap@0', kind: 'object' },
            { type: 'PropertyAdded', object: 'heap@0', property: 'x' },
            { type: 'PropertyChanged', object: 'heap@0', property: 'x' },
            { type: 'PropertyAdded', object: 'heap@5', property: 'y' },
        ];

        const insights = analyzeEvents(events);
        const mutated = insights.filter((i) => i.type === 'PropertyMutatedAfterAllocation') as PropertyMutatedAfterAllocation[];
        expect(mutated.length).toBe(2);
        expect(mutated[0]!.address).toBe('heap@0');
        expect(mutated[0]!.property).toBe('x');
        expect(mutated[1]!.address).toBe('heap@0');
        expect(mutated[1]!.property).toBe('x');
    });

    it('deterministic across 3 runs', () => {
        const events: ExplanationEvent[] = [
            { type: 'ObjectAllocated', address: 'heap@0', kind: 'object' },
            { type: 'ObjectCollected', address: 'heap@0', kind: 'object' },
            { type: 'ClosureCaptured', function: 'heap@1', environment: 'env@0' },
            { type: 'VariableRebound', env: 'env@0', name: 'x', from: 'heap@0', to: 'heap@1' },
            { type: 'VariableRebound', env: 'env@0', name: 'x', from: 'heap@1', to: 'heap@2' },
            { type: 'PropertyAdded', object: 'heap@0', property: 'a' },
        ];

        const runs = Array.from({ length: 3 }, () => analyzeEvents(events));
        expect(runs[0]).toEqual(runs[1]);
        expect(runs[1]).toEqual(runs[2]);
    });

    it('insights are sorted by type then content', () => {
        const events: ExplanationEvent[] = [
            { type: 'ClosureCaptured', function: 'heap@2', environment: 'env@0' },
            { type: 'ObjectAllocated', address: 'heap@0', kind: 'object' },
            { type: 'ObjectCollected', address: 'heap@0', kind: 'object' },
            { type: 'VariableRebound', env: 'env@0', name: 'z', from: 'heap@0', to: 'heap@1' },
            { type: 'VariableRebound', env: 'env@0', name: 'z', from: 'heap@1', to: 'heap@2' },
            { type: 'PropertyAdded', object: 'heap@0', property: 'b' },
        ];

        const insights = analyzeEvents(events);
        const types = insights.map((i) => i.type);
        const sorted = [...types].sort();
        expect(types).toEqual(sorted);
    });
});
