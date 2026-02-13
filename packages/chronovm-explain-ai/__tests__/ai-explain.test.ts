import { describe, it, expect } from 'vitest';
import type { Insight } from 'chronovm-insight';
import { createExplanationPlans } from '../src/index.ts';

describe('Explanation Plans', () => {
    it('produces one plan per insight', () => {
        const insights: Insight[] = [
            { type: 'RepeatedRebinding', env: 'env@0', variable: 'x', count: 3 },
            { type: 'ObjectAllocatedAndCollected', address: 'heap@0' },
            { type: 'ClosureRetainsEnvironment', function: 'heap@1', environment: 'env@0' },
            { type: 'PropertyMutatedAfterAllocation', address: 'heap@2', property: 'a' },
        ];

        const plans = createExplanationPlans(insights);
        expect(plans.length).toBe(4);
    });

    it('maps RepeatedRebinding correctly', () => {
        const insights: Insight[] = [
            { type: 'RepeatedRebinding', env: 'env@0', variable: 'x', count: 5 },
        ];

        const plans = createExplanationPlans(insights);
        expect(plans[0]).toEqual({
            category: 'PerformancePattern',
            key: 'RepeatedRebinding',
            data: { variable: 'x', count: 5 },
        });
    });

    it('maps ObjectAllocatedAndCollected correctly', () => {
        const insights: Insight[] = [
            { type: 'ObjectAllocatedAndCollected', address: 'heap@0' },
        ];

        const plans = createExplanationPlans(insights);
        expect(plans[0]).toEqual({
            category: 'MemoryLifecycle',
            key: 'ShortLivedObject',
            data: { address: 'heap@0' },
        });
    });

    it('maps ClosureRetainsEnvironment correctly', () => {
        const insights: Insight[] = [
            { type: 'ClosureRetainsEnvironment', function: 'heap@1', environment: 'env@0' },
        ];

        const plans = createExplanationPlans(insights);
        expect(plans[0]).toEqual({
            category: 'ClosureBehavior',
            key: 'ClosureCapture',
            data: { function: 'heap@1', environment: 'env@0' },
        });
    });

    it('maps PropertyMutatedAfterAllocation correctly', () => {
        const insights: Insight[] = [
            { type: 'PropertyMutatedAfterAllocation', address: 'heap@2', property: 'a' },
        ];

        const plans = createExplanationPlans(insights);
        expect(plans[0]).toEqual({
            category: 'MutationPattern',
            key: 'PostAllocationMutation',
            data: { object: 'heap@2' },
        });
    });

    it('sorted output by category then key then data', () => {
        const insights: Insight[] = [
            { type: 'RepeatedRebinding', env: 'env@0', variable: 'z', count: 2 },
            { type: 'ClosureRetainsEnvironment', function: 'heap@1', environment: 'env@0' },
            { type: 'ObjectAllocatedAndCollected', address: 'heap@0' },
            { type: 'PropertyMutatedAfterAllocation', address: 'heap@2', property: 'a' },
        ];

        const plans = createExplanationPlans(insights);
        const categories = plans.map((p) => p.category);
        expect(categories).toEqual([...categories].sort());
    });

    it('deterministic across 3 runs', () => {
        const insights: Insight[] = [
            { type: 'PropertyMutatedAfterAllocation', address: 'heap@2', property: 'b' },
            { type: 'RepeatedRebinding', env: 'env@0', variable: 'x', count: 3 },
            { type: 'ObjectAllocatedAndCollected', address: 'heap@0' },
            { type: 'ClosureRetainsEnvironment', function: 'heap@1', environment: 'env@0' },
        ];

        const runs = Array.from({ length: 3 }, () => createExplanationPlans(insights));
        expect(runs[0]).toEqual(runs[1]);
        expect(runs[1]).toEqual(runs[2]);
    });
});
