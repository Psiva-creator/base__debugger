import type { VMState } from './state.ts';
import type { HeapAddress, HeapValue, FunctionValue, ObjectValue } from './heap.ts';
import type { EnvironmentAddress, EnvironmentRecord } from './environment.ts';

function markReachable(state: VMState): { heap: Set<string>; envs: Set<string> } {
    const reachableHeap = new Set<string>();
    const reachableEnvs = new Set<string>();

    function markEnv(envAddr: EnvironmentAddress | null): void {
        if (envAddr === null || reachableEnvs.has(envAddr)) return;
        reachableEnvs.add(envAddr);
        const record = state.environmentRecords[envAddr];
        if (!record) return;
        const keys = Object.keys(record.bindings).sort();
        for (const key of keys) {
            markHeap(record.bindings[key]!);
        }
        markEnv(record.parent);
    }

    function markHeap(addr: HeapAddress | string): void {
        if (reachableHeap.has(addr)) return;
        reachableHeap.add(addr);
        const value = state.heap[addr];
        if (value === undefined) return;
        if (typeof value === 'number' || typeof value === 'boolean') return;
        if (typeof value === 'object' && value !== null && 'type' in value) {
            if ((value as FunctionValue).type === 'function') {
                markEnv((value as FunctionValue).environment as EnvironmentAddress);
            } else if ((value as ObjectValue).type === 'object') {
                const obj = value as ObjectValue;
                const propKeys = Object.keys(obj.properties).sort();
                for (const key of propKeys) {
                    markHeap(obj.properties[key]!);
                }
            }
        }
    }

    for (const addr of state.operandStack) {
        markHeap(addr);
    }

    markEnv(state.currentEnvironment);
    markEnv(state.globalEnvironment);

    for (const frame of state.callStack) {
        markEnv(frame.environment);
    }

    for (const envAddr of Object.keys(state.environmentRecords)) {
        if (reachableEnvs.has(envAddr)) continue;
        const record = state.environmentRecords[envAddr]!;
        let ancestor: EnvironmentAddress | null = record.parent;
        while (ancestor !== null) {
            if (reachableEnvs.has(ancestor)) {
                markEnv(envAddr as EnvironmentAddress);
                break;
            }
            const parentRecord = state.environmentRecords[ancestor];
            if (!parentRecord) break;
            ancestor = parentRecord.parent;
        }
    }

    return { heap: reachableHeap, envs: reachableEnvs };
}

export function collectGarbage(state: VMState): VMState {
    const { heap: reachableHeap, envs: reachableEnvs } = markReachable(state);

    const newHeap: Record<string, HeapValue> = {};
    for (const addr of Object.keys(state.heap)) {
        if (reachableHeap.has(addr)) {
            newHeap[addr] = state.heap[addr]!;
        }
    }

    const newEnvRecords: Record<string, EnvironmentRecord> = {};
    for (const addr of Object.keys(state.environmentRecords)) {
        if (reachableEnvs.has(addr)) {
            newEnvRecords[addr] = state.environmentRecords[addr]!;
        }
    }

    return {
        ...state,
        heap: newHeap,
        environmentRecords: newEnvRecords,
    };
}
