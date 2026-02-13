import type { VMState } from 'chronovm-core';
import type { HeapValue, FunctionValue, ObjectValue, HeapAddress } from 'chronovm-core';
import type { EnvironmentAddress, EnvironmentRecord } from 'chronovm-core';

export type PrimitiveNode = {
    readonly kind: 'primitive';
    readonly address: string;
    readonly value: number | boolean;
};

export type ObjectNode = {
    readonly kind: 'object';
    readonly address: string;
    readonly properties: readonly { readonly key: string; readonly address: string }[];
};

export type FunctionNode = {
    readonly kind: 'function';
    readonly address: string;
    readonly entry: number;
    readonly environment: string;
};

export type HeapNode = PrimitiveNode | ObjectNode | FunctionNode;

export type EnvironmentEntry = {
    readonly address: string;
    readonly parent: string | null;
    readonly bindings: readonly { readonly name: string; readonly address: string }[];
};

export type MemoryModel = {
    readonly heapNodes: readonly HeapNode[];
    readonly environments: readonly EnvironmentEntry[];
    readonly operandStack: readonly string[];
    readonly currentEnvironment: string;
    readonly globalEnvironment: string;
};

export type MemoryDiff = {
    readonly addedHeapNodes: readonly string[];
    readonly removedHeapNodes: readonly string[];
    readonly changedHeapNodes: readonly string[];
    readonly addedBindings: readonly { readonly env: string; readonly name: string }[];
    readonly removedBindings: readonly { readonly env: string; readonly name: string }[];
    readonly changedBindings: readonly { readonly env: string; readonly name: string }[];
};

function classifyHeapValue(address: string, value: HeapValue): HeapNode {
    if (typeof value === 'number' || typeof value === 'boolean') {
        return { kind: 'primitive', address, value };
    }
    if (typeof value === 'object' && value !== null && 'type' in value) {
        if ((value as FunctionValue).type === 'function') {
            const fn = value as FunctionValue;
            return { kind: 'function', address, entry: fn.entry, environment: fn.environment };
        }
        if ((value as ObjectValue).type === 'object') {
            const obj = value as ObjectValue;
            const properties = Object.keys(obj.properties).sort().map((key) => ({
                key,
                address: obj.properties[key]! as string,
            }));
            return { kind: 'object', address, properties };
        }
    }
    return { kind: 'primitive', address, value: value as number };
}

function buildEnvironmentEntry(record: EnvironmentRecord): EnvironmentEntry {
    const bindings = Object.keys(record.bindings).sort().map((name) => ({
        name,
        address: record.bindings[name]! as string,
    }));
    return {
        address: record.address as string,
        parent: record.parent as string | null,
        bindings,
    };
}

export function buildMemoryModel(state: VMState): MemoryModel {
    const heapAddresses = Object.keys(state.heap).sort();
    const heapNodes: HeapNode[] = heapAddresses.map((addr) =>
        classifyHeapValue(addr, state.heap[addr]!),
    );

    const envAddresses = Object.keys(state.environmentRecords).sort();
    const environments: EnvironmentEntry[] = envAddresses.map((addr) =>
        buildEnvironmentEntry(state.environmentRecords[addr]!),
    );

    return {
        heapNodes,
        environments,
        operandStack: [...state.operandStack] as string[],
        currentEnvironment: state.currentEnvironment as string,
        globalEnvironment: state.globalEnvironment as string,
    };
}

export function diffMemoryModels(a: MemoryModel, b: MemoryModel): MemoryDiff {
    const aHeapMap = new Map(a.heapNodes.map((n) => [n.address, n]));
    const bHeapMap = new Map(b.heapNodes.map((n) => [n.address, n]));

    const addedHeapNodes: string[] = [];
    const removedHeapNodes: string[] = [];
    const changedHeapNodes: string[] = [];

    for (const addr of [...new Set([...aHeapMap.keys(), ...bHeapMap.keys()])].sort()) {
        const inA = aHeapMap.has(addr);
        const inB = bHeapMap.has(addr);
        if (!inA && inB) {
            addedHeapNodes.push(addr);
        } else if (inA && !inB) {
            removedHeapNodes.push(addr);
        } else if (inA && inB) {
            if (JSON.stringify(aHeapMap.get(addr)) !== JSON.stringify(bHeapMap.get(addr))) {
                changedHeapNodes.push(addr);
            }
        }
    }

    const aEnvMap = new Map(a.environments.map((e) => [e.address, e]));
    const bEnvMap = new Map(b.environments.map((e) => [e.address, e]));

    const addedBindings: { env: string; name: string }[] = [];
    const removedBindings: { env: string; name: string }[] = [];
    const changedBindings: { env: string; name: string }[] = [];

    for (const envAddr of [...new Set([...aEnvMap.keys(), ...bEnvMap.keys()])].sort()) {
        const envA = aEnvMap.get(envAddr);
        const envB = bEnvMap.get(envAddr);
        const aBindings = new Map(envA?.bindings.map((b) => [b.name, b.address]) ?? []);
        const bBindings = new Map(envB?.bindings.map((b) => [b.name, b.address]) ?? []);

        for (const name of [...new Set([...aBindings.keys(), ...bBindings.keys()])].sort()) {
            const inA = aBindings.has(name);
            const inB = bBindings.has(name);
            if (!inA && inB) {
                addedBindings.push({ env: envAddr, name });
            } else if (inA && !inB) {
                removedBindings.push({ env: envAddr, name });
            } else if (inA && inB && aBindings.get(name) !== bBindings.get(name)) {
                changedBindings.push({ env: envAddr, name });
            }
        }
    }

    return {
        addedHeapNodes,
        removedHeapNodes,
        changedHeapNodes,
        addedBindings,
        removedBindings,
        changedBindings,
    };
}
