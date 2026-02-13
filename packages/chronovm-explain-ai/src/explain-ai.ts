import type { Insight } from 'chronovm-insight';

export type ExplanationPlan = {
    readonly category: string;
    readonly key: string;
    readonly data: Record<string, unknown>;
};

function comparePlans(a: ExplanationPlan, b: ExplanationPlan): number {
    if (a.category !== b.category) return a.category < b.category ? -1 : 1;
    if (a.key !== b.key) return a.key < b.key ? -1 : 1;
    const aData = JSON.stringify(a.data);
    const bData = JSON.stringify(b.data);
    return aData < bData ? -1 : aData > bData ? 1 : 0;
}

function insightToPlan(insight: Insight): ExplanationPlan {
    switch (insight.type) {
        case 'RepeatedRebinding':
            return {
                category: 'PerformancePattern',
                key: 'RepeatedRebinding',
                data: { variable: insight.variable, count: insight.count },
            };
        case 'ObjectAllocatedAndCollected':
            return {
                category: 'MemoryLifecycle',
                key: 'ShortLivedObject',
                data: { address: insight.address },
            };
        case 'ClosureRetainsEnvironment':
            return {
                category: 'ClosureBehavior',
                key: 'ClosureCapture',
                data: { function: insight.function, environment: insight.environment },
            };
        case 'PropertyMutatedAfterAllocation':
            return {
                category: 'MutationPattern',
                key: 'PostAllocationMutation',
                data: { object: insight.address },
            };
    }
}

export function createExplanationPlans(
    insights: readonly Insight[],
): readonly ExplanationPlan[] {
    return insights.map(insightToPlan).sort(comparePlans);
}
