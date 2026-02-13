import type { ExplanationEvent } from 'chronovm-explain';

export type RepeatedRebinding = {
    readonly type: 'RepeatedRebinding';
    readonly env: string;
    readonly variable: string;
    readonly count: number;
};

export type ObjectAllocatedAndCollected = {
    readonly type: 'ObjectAllocatedAndCollected';
    readonly address: string;
};

export type ClosureRetainsEnvironment = {
    readonly type: 'ClosureRetainsEnvironment';
    readonly function: string;
    readonly environment: string;
};

export type PropertyMutatedAfterAllocation = {
    readonly type: 'PropertyMutatedAfterAllocation';
    readonly address: string;
    readonly property: string;
};

export type Insight =
    | RepeatedRebinding
    | ObjectAllocatedAndCollected
    | ClosureRetainsEnvironment
    | PropertyMutatedAfterAllocation;

function compareInsights(a: Insight, b: Insight): number {
    if (a.type !== b.type) return a.type < b.type ? -1 : 1;
    const aKey = JSON.stringify(a);
    const bKey = JSON.stringify(b);
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
}

export function analyzeEvents(events: readonly ExplanationEvent[]): readonly Insight[] {
    const insights: Insight[] = [];

    const rebindCounts = new Map<string, { env: string; variable: string; count: number }>();
    for (const e of events) {
        if (e.type === 'VariableRebound') {
            const key = `${e.env}|${e.name}`;
            const existing = rebindCounts.get(key);
            if (existing) {
                existing.count++;
            } else {
                rebindCounts.set(key, { env: e.env, variable: e.name, count: 1 });
            }
        }
    }
    for (const entry of [...rebindCounts.values()]) {
        if (entry.count > 1) {
            insights.push({
                type: 'RepeatedRebinding',
                env: entry.env,
                variable: entry.variable,
                count: entry.count,
            });
        }
    }

    const allocated = new Set<string>();
    const collected = new Set<string>();
    for (const e of events) {
        if (e.type === 'ObjectAllocated') allocated.add(e.address);
        if (e.type === 'ObjectCollected') collected.add(e.address);
    }
    for (const addr of allocated) {
        if (collected.has(addr)) {
            insights.push({ type: 'ObjectAllocatedAndCollected', address: addr });
        }
    }

    for (const e of events) {
        if (e.type === 'ClosureCaptured') {
            insights.push({
                type: 'ClosureRetainsEnvironment',
                function: e.function,
                environment: e.environment,
            });
        }
    }

    for (const e of events) {
        if (e.type === 'PropertyAdded' || e.type === 'PropertyChanged') {
            if (allocated.has(e.object)) {
                insights.push({
                    type: 'PropertyMutatedAfterAllocation',
                    address: e.object,
                    property: e.property,
                });
            }
        }
    }

    return insights.sort(compareInsights);
}
