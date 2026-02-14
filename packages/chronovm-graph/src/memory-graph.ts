import type {
    MemoryModel,
    HeapNode,
    EnvironmentEntry,
    ObjectNode,
    FunctionNode,
    ListNode,
} from 'chronovm-model';

export type GraphNodeKind = 'environment' | 'primitive' | 'object' | 'function' | 'list';

export type GraphNode = {
    readonly id: string;
    readonly kind: GraphNodeKind;
    readonly label: string;
};

export type GraphEdge = {
    readonly from: string;
    readonly to: string;
    readonly label: string;
};

export type MemoryGraph = {
    readonly nodes: readonly GraphNode[];
    readonly edges: readonly GraphEdge[];
};

function heapNodeKind(node: HeapNode): GraphNodeKind {
    return node.kind === 'primitive' ? 'primitive' : node.kind;
}

function heapNodeLabel(node: HeapNode): string {
    if (node.kind === 'primitive') return String(node.value);
    if (node.kind === 'object') return 'Object';
    if (node.kind === 'list') return 'List';
    return `fn@${node.entry}`;
}

function envLabel(env: EnvironmentEntry): string {
    return env.address;
}

function compareEdges(a: GraphEdge, b: GraphEdge): number {
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to !== b.to) return a.to < b.to ? -1 : 1;
    if (a.label !== b.label) return a.label < b.label ? -1 : 1;
    return 0;
}

export function buildMemoryGraph(model: MemoryModel): MemoryGraph {
    const nodeMap = new Map<string, GraphNode>();
    const edgeSet = new Map<string, GraphEdge>();

    for (const env of model.environments) {
        nodeMap.set(env.address, {
            id: env.address,
            kind: 'environment',
            label: envLabel(env),
        });
    }

    for (const node of model.heapNodes) {
        nodeMap.set(node.address, {
            id: node.address,
            kind: heapNodeKind(node),
            label: heapNodeLabel(node),
        });
    }

    for (const env of model.environments) {
        for (const binding of env.bindings) {
            const edge: GraphEdge = {
                from: env.address,
                to: binding.address,
                label: binding.name,
            };
            edgeSet.set(`${edge.from}|${edge.to}|${edge.label}`, edge);
        }
    }

    for (const node of model.heapNodes) {
        if (node.kind === 'object') {
            const obj = node as ObjectNode;
            for (const prop of obj.properties) {
                const edge: GraphEdge = {
                    from: obj.address,
                    to: prop.address,
                    label: prop.key,
                };
                edgeSet.set(`${edge.from}|${edge.to}|${edge.label}`, edge);
            }
        } else if (node.kind === 'function') {
            const fn = node as FunctionNode;
            const edge: GraphEdge = {
                from: fn.address,
                to: fn.environment,
                label: 'closure',
            };
            edgeSet.set(`${edge.from}|${edge.to}|${edge.label}`, edge);
        } else if (node.kind === 'list') {
            const list = node as ListNode;
            for (const elem of list.elements) {
                const edge: GraphEdge = {
                    from: list.address,
                    to: elem.address,
                    label: `[${elem.index}]`,
                };
                edgeSet.set(`${edge.from}|${edge.to}|${edge.label}`, edge);
            }
        }
    }

    const nodes = [...nodeMap.values()].sort((a, b) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    const edges = [...edgeSet.values()].sort(compareEdges);

    return { nodes, edges };
}
