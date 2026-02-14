import type { MemoryDiff } from 'chronovm-model';
import type { MemoryGraph, GraphNode } from 'chronovm-graph';

export type VariableBoundEvent = {
    readonly type: 'VariableBound';
    readonly env: string;
    readonly name: string;
    readonly address: string;
};

export type VariableReboundEvent = {
    readonly type: 'VariableRebound';
    readonly env: string;
    readonly name: string;
    readonly from: string;
    readonly to: string;
};

export type VariableUnboundEvent = {
    readonly type: 'VariableUnbound';
    readonly env: string;
    readonly name: string;
    readonly address: string;
};

export type PropertyAddedEvent = {
    readonly type: 'PropertyAdded';
    readonly object: string;
    readonly property: string;
};

export type PropertyChangedEvent = {
    readonly type: 'PropertyChanged';
    readonly object: string;
    readonly property: string;
};

export type PropertyRemovedEvent = {
    readonly type: 'PropertyRemoved';
    readonly object: string;
    readonly property: string;
};

export type ObjectAllocatedEvent = {
    readonly type: 'ObjectAllocated';
    readonly address: string;
    readonly kind: string;
};

export type ObjectCollectedEvent = {
    readonly type: 'ObjectCollected';
    readonly address: string;
    readonly kind: string;
};

export type EnvironmentCreatedEvent = {
    readonly type: 'EnvironmentCreated';
    readonly address: string;
};

export type EnvironmentDestroyedEvent = {
    readonly type: 'EnvironmentDestroyed';
    readonly address: string;
};

export type ClosureCapturedEvent = {
    readonly type: 'ClosureCaptured';
    readonly function: string;
    readonly environment: string;
};

export type ListCreatedEvent = {
    readonly type: 'ListCreated';
    readonly address: string;
};

export type ListAppendedEvent = {
    readonly type: 'ListAppended';
    readonly list: string;
    readonly value: string;
};

export type ListIndexAccessedEvent = {
    readonly type: 'ListIndexAccessed';
    readonly list: string;
    readonly index: number;
    readonly value: string;
};

export type ListIndexUpdatedEvent = {
    readonly type: 'ListIndexUpdated';
    readonly list: string;
    readonly index: number;
    readonly value: string;
};

export type ControlFlowDecisionEvent = {
    readonly type: 'ControlFlowDecision';
    readonly fromPc: number;
    readonly toPc: number;
    readonly condition?: boolean;
    readonly label: string;
};

export type ExplanationEvent =
    | VariableBoundEvent
    | VariableReboundEvent
    | VariableUnboundEvent
    | PropertyAddedEvent
    | PropertyChangedEvent
    | PropertyRemovedEvent
    | ObjectAllocatedEvent
    | ObjectCollectedEvent
    | EnvironmentCreatedEvent
    | EnvironmentDestroyedEvent
    | ClosureCapturedEvent
    | ListCreatedEvent
    | ListAppendedEvent
    | ListIndexAccessedEvent
    | ListIndexUpdatedEvent
    | ControlFlowDecisionEvent;

function compareEvents(a: ExplanationEvent, b: ExplanationEvent): number {
    if (a.type !== b.type) return a.type < b.type ? -1 : 1;
    const aKey = JSON.stringify(a);
    const bKey = JSON.stringify(b);
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
}

function nodeKindOf(graph: MemoryGraph, address: string): string {
    const node = graph.nodes.find((n: GraphNode) => n.id === address);
    return node?.kind ?? 'unknown';
}

function lookupBindingAddress(graph: MemoryGraph, env: string, name: string): string {
    const edge = graph.edges.find((e) => e.from === env && e.label === name);
    return edge?.to ?? 'unknown';
}

function findPropertyChanges(
    diff: MemoryDiff,
    graphBefore: MemoryGraph,
    graphAfter: MemoryGraph,
): ExplanationEvent[] {
    const events: ExplanationEvent[] = [];

    for (const addr of diff.changedHeapNodes) {
        const beforeNode = graphBefore.nodes.find((n: GraphNode) => n.id === addr);
        const afterNode = graphAfter.nodes.find((n: GraphNode) => n.id === addr);
        if (!beforeNode || !afterNode) continue;
        if (beforeNode.kind !== 'object' || afterNode.kind !== 'object') continue;

        const beforeEdges = graphBefore.edges.filter((e) => e.from === addr);
        const afterEdges = graphAfter.edges.filter((e) => e.from === addr);
        const beforeProps = new Map(beforeEdges.map((e) => [e.label, e.to]));
        const afterProps = new Map(afterEdges.map((e) => [e.label, e.to]));

        const allKeys = [...new Set([...beforeProps.keys(), ...afterProps.keys()])].sort();
        for (const key of allKeys) {
            const inBefore = beforeProps.has(key);
            const inAfter = afterProps.has(key);
            if (!inBefore && inAfter) {
                events.push({ type: 'PropertyAdded', object: addr, property: key });
            } else if (inBefore && !inAfter) {
                events.push({ type: 'PropertyRemoved', object: addr, property: key });
            } else if (inBefore && inAfter && beforeProps.get(key) !== afterProps.get(key)) {
                events.push({ type: 'PropertyChanged', object: addr, property: key });
            }
        }
    }

    return events;
}

function findClosureEvents(
    diff: MemoryDiff,
    graphAfter: MemoryGraph,
): ExplanationEvent[] {
    const events: ExplanationEvent[] = [];

    for (const addr of diff.addedHeapNodes) {
        const node = graphAfter.nodes.find((n: GraphNode) => n.id === addr);
        if (!node || node.kind !== 'function') continue;
        const closureEdge = graphAfter.edges.find(
            (e) => e.from === addr && e.label === 'closure',
        );
        if (closureEdge) {
            events.push({
                type: 'ClosureCaptured',
                function: addr,
                environment: closureEdge.to,
            });
        }
    }

    return events;
}

function findEnvironmentEvents(
    graphBefore: MemoryGraph,
    graphAfter: MemoryGraph,
): ExplanationEvent[] {
    const events: ExplanationEvent[] = [];
    const beforeEnvs = new Set(
        graphBefore.nodes.filter((n: GraphNode) => n.kind === 'environment').map((n: GraphNode) => n.id),
    );
    const afterEnvs = new Set(
        graphAfter.nodes.filter((n: GraphNode) => n.kind === 'environment').map((n: GraphNode) => n.id),
    );

    for (const addr of [...afterEnvs].sort()) {
        if (!beforeEnvs.has(addr)) {
            events.push({ type: 'EnvironmentCreated', address: addr });
        }
    }
    for (const addr of [...beforeEnvs].sort()) {
        if (!afterEnvs.has(addr)) {
            events.push({ type: 'EnvironmentDestroyed', address: addr });
        }
    }

    return events;
}

function findListChanges(
    diff: MemoryDiff,
    graphBefore: MemoryGraph,
    graphAfter: MemoryGraph,
): ExplanationEvent[] {
    const events: ExplanationEvent[] = [];

    // ListCreated: new list heap nodes
    for (const addr of diff.addedHeapNodes) {
        const node = graphAfter.nodes.find((n: GraphNode) => n.id === addr);
        if (node && node.kind === 'list') {
            events.push({ type: 'ListCreated', address: addr });
        }
    }

    // ListAppended / ListIndexUpdated: changed list heap nodes
    for (const addr of diff.changedHeapNodes) {
        const beforeNode = graphBefore.nodes.find((n: GraphNode) => n.id === addr);
        const afterNode = graphAfter.nodes.find((n: GraphNode) => n.id === addr);
        if (!beforeNode || !afterNode) continue;
        if (beforeNode.kind !== 'list' || afterNode.kind !== 'list') continue;

        const beforeEdges = graphBefore.edges
            .filter((e) => e.from === addr && e.label.startsWith('['))
            .sort((a, b) => a.label < b.label ? -1 : a.label > b.label ? 1 : 0);
        const afterEdges = graphAfter.edges
            .filter((e) => e.from === addr && e.label.startsWith('['))
            .sort((a, b) => a.label < b.label ? -1 : a.label > b.label ? 1 : 0);

        const beforeMap = new Map(beforeEdges.map((e) => [e.label, e.to]));
        const afterMap = new Map(afterEdges.map((e) => [e.label, e.to]));

        // New indices → appended
        for (const [label, to] of [...afterMap.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
            if (!beforeMap.has(label)) {
                events.push({ type: 'ListAppended', list: addr, value: to });
            }
        }

        // Changed indices → updated
        for (const [label, to] of [...afterMap.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
            if (beforeMap.has(label) && beforeMap.get(label) !== to) {
                const indexMatch = label.match(/\[(\d+)\]/);
                const index = indexMatch ? parseInt(indexMatch[1]!, 10) : 0;
                events.push({ type: 'ListIndexUpdated', list: addr, index, value: to });
            }
        }
    }

    return events;
}

export function explainDiff(
    diff: MemoryDiff,
    graphBefore: MemoryGraph,
    graphAfter: MemoryGraph,
): readonly ExplanationEvent[] {
    const events: ExplanationEvent[] = [];

    for (const addr of diff.addedHeapNodes) {
        events.push({
            type: 'ObjectAllocated',
            address: addr,
            kind: nodeKindOf(graphAfter, addr),
        });
    }

    for (const addr of diff.removedHeapNodes) {
        events.push({
            type: 'ObjectCollected',
            address: addr,
            kind: nodeKindOf(graphBefore, addr),
        });
    }

    for (const b of diff.addedBindings) {
        events.push({
            type: 'VariableBound',
            env: b.env,
            name: b.name,
            address: lookupBindingAddress(graphAfter, b.env, b.name),
        });
    }

    for (const b of diff.removedBindings) {
        events.push({
            type: 'VariableUnbound',
            env: b.env,
            name: b.name,
            address: lookupBindingAddress(graphBefore, b.env, b.name),
        });
    }

    for (const b of diff.changedBindings) {
        events.push({
            type: 'VariableRebound',
            env: b.env,
            name: b.name,
            from: lookupBindingAddress(graphBefore, b.env, b.name),
            to: lookupBindingAddress(graphAfter, b.env, b.name),
        });
    }

    events.push(...findPropertyChanges(diff, graphBefore, graphAfter));
    events.push(...findClosureEvents(diff, graphAfter));
    events.push(...findEnvironmentEvents(graphBefore, graphAfter));
    events.push(...findListChanges(diff, graphBefore, graphAfter));

    return events.sort(compareEvents);
}
