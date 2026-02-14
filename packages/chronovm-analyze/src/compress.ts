// ─────────────────────────────────────────────
// Semantic Step Compression Layer
// ─────────────────────────────────────────────
// Converts a raw VM trace (~130 micro-steps) into
// high-level semantic steps (~25) aligned with
// Python source code lines.
//
// Pure function. No mutation. No IO.
// ─────────────────────────────────────────────

import type { VMState, IRInstruction } from 'chronovm-core';

// ── Schema ──

export type SemanticType =
    | 'assignment'
    | 'print'
    | 'branch_decision'
    | 'loop_check'
    | 'loop_iteration'
    | 'loop_exit'
    | 'function_def'
    | 'function_call'
    | 'function_return'
    | 'list_create'
    | 'list_mutate'
    | 'object_create'
    | 'property_access'
    | 'class_def'
    | 'expression'
    | 'halt';

export type VariableChange = {
    readonly before: string | null;
    readonly after: string;
};

export type SemanticStep = {
    /** Index in the compressed step array (0-based) */
    readonly index: number;

    /** Source line number this step corresponds to */
    readonly sourceLine: number;

    /** Classification of what this step does */
    readonly semanticType: SemanticType;

    /** Human-readable one-liner */
    readonly summaryText: string;

    /** Range of raw micro-step indices [start, end) that were compressed */
    readonly microStepRange: readonly [number, number];

    /** The final VMState — the "result" state after all micro-steps */
    readonly resultState: VMState;

    /** Variables that changed: Map<varName, {before, after}> */
    readonly variableChanges: ReadonlyMap<string, VariableChange>;

    /** Output lines emitted during this step */
    readonly outputEmitted: readonly string[];

    /** Control flow info (only for branches/loops) */
    readonly controlFlow?: {
        readonly type: 'branch' | 'loop_check';
        readonly conditionResult: boolean;
        readonly label: string;
    };

    /** Loop iteration number (1-based, only inside loops) */
    readonly iterationNumber?: number;
};

// ── Internal group builder ──

type RawGroup = {
    startIdx: number;
    endIdx: number;
    sourceLine: number;
    opcodes: string[];
};

// ── Helpers ──

function getInstruction(state: VMState): IRInstruction | undefined {
    if (state.pc >= 0 && state.pc < state.program.length) {
        return state.program[state.pc];
    }
    return undefined;
}

function resolveHeapPrimitive(state: VMState, addr: string): string {
    const val = state.heap[addr];
    if (val === undefined) return '?';
    if (val === null) return 'None';
    if (val === true) return 'True';
    if (val === false) return 'False';
    if (typeof val === 'object' && 'type' in val) {
        if ((val as any).type === 'list') return '[list]';
        if ((val as any).type === 'object') return '{object}';
        if ((val as any).type === 'function') return '<function>';
    }
    return String(val);
}

function getBindings(state: VMState): Map<string, string> {
    const bindings = new Map<string, string>();
    const envRec = state.environmentRecords[state.currentEnvironment];
    if (!envRec) return bindings;
    for (const [name, addr] of Object.entries(envRec.bindings)) {
        // Skip internal compiler variables
        if (name.startsWith('__') || name.startsWith('arg')) continue;
        bindings.set(name, resolveHeapPrimitive(state, addr as string));
    }
    return bindings;
}

function diffBindings(
    before: Map<string, string>,
    after: Map<string, string>,
): Map<string, VariableChange> {
    const changes = new Map<string, VariableChange>();
    for (const [name, afterVal] of after) {
        const beforeVal = before.get(name) ?? null;
        if (beforeVal !== afterVal) {
            changes.set(name, { before: beforeVal, after: afterVal });
        }
    }
    return changes;
}

function diffOutput(before: readonly string[], after: readonly string[]): readonly string[] {
    if (after.length <= before.length) return [];
    return after.slice(before.length);
}

// ── Semantic Type Inference ──

function inferSemanticType(opcodes: string[], controlFlowInfo?: { type: string }): SemanticType {
    const last = opcodes[opcodes.length - 1];
    const has = (op: string) => opcodes.includes(op);

    if (last === 'HALT') return 'halt';
    if (last === 'RET' || has('RET')) return 'function_return';
    if (has('BUILD_CLASS')) return 'class_def';
    if (has('MAKE_FUNCTION') && has('STORE')) return 'function_def';
    if (has('CALL')) return 'function_call';
    if (has('PRINT')) return 'print';
    if (has('NEW_LIST')) return 'list_create';
    if (has('LIST_APPEND') || has('LIST_SET')) return 'list_mutate';
    if (has('NEW_OBJECT')) return 'object_create';
    if (has('SET_PROPERTY') || has('GET_PROPERTY')) return 'property_access';

    if (has('JUMP_IF_FALSE') || has('JUMP_IF_TRUE')) {
        if (controlFlowInfo?.type === 'loop_check') return 'loop_check';
        return 'branch_decision';
    }

    if (has('STORE')) return 'assignment';

    return 'expression';
}

// ── Summary Text Generation ──

function buildSummaryText(
    semanticType: SemanticType,
    variableChanges: ReadonlyMap<string, VariableChange>,
    outputEmitted: readonly string[],
    controlFlow?: { type: string; conditionResult: boolean; label: string },
    iterationNumber?: number,
    sourceLine?: number,
): string {
    switch (semanticType) {
        case 'assignment': {
            const entries = [...variableChanges.entries()];
            if (entries.length === 1) {
                const [name, change] = entries[0]!;
                return `${name} = ${change.after}`;
            }
            if (entries.length > 1) {
                return entries.map(([n, c]) => `${n} = ${c.after}`).join(', ');
            }
            return `assignment (line ${sourceLine})`;
        }
        case 'print': {
            if (outputEmitted.length > 0) {
                return `print(${outputEmitted.join(', ')})`;
            }
            return `print()`;
        }
        case 'branch_decision': {
            if (controlFlow) {
                return `Branch: ${controlFlow.label} → ${controlFlow.conditionResult ? 'True' : 'False'}`;
            }
            return `Branch decision (line ${sourceLine})`;
        }
        case 'loop_check': {
            if (controlFlow) {
                const iter = iterationNumber ? ` (iteration ${iterationNumber})` : '';
                return `Loop check → ${controlFlow.conditionResult ? 'True' : 'False'}${iter}`;
            }
            return `Loop check (line ${sourceLine})`;
        }
        case 'loop_exit':
            return `Loop exited`;
        case 'function_def': {
            const entries = [...variableChanges.entries()];
            const name = entries.find(([n]) => !n.startsWith('__'))?.[0] ?? '?';
            return `def ${name}()`;
        }
        case 'function_call':
            return `Function call (line ${sourceLine})`;
        case 'function_return': {
            const entries = [...variableChanges.entries()];
            if (entries.length > 0) {
                return `return → ${entries[0]![1].after}`;
            }
            return `return`;
        }
        case 'list_create': {
            const entries = [...variableChanges.entries()];
            const name = entries.find(([n]) => !n.startsWith('__'))?.[0] ?? '?';
            return `${name} = []`;
        }
        case 'list_mutate':
            return `List mutation (line ${sourceLine})`;
        case 'object_create':
            return `Object created (line ${sourceLine})`;
        case 'property_access':
            return `Property access (line ${sourceLine})`;
        case 'class_def': {
            const entries = [...variableChanges.entries()];
            const name = entries.find(([n]) => !n.startsWith('__'))?.[0] ?? '?';
            return `class ${name}`;
        }
        case 'halt':
            return '— Program ended —';
        case 'expression':
            return `Expression (line ${sourceLine})`;
        default:
            return `Step (line ${sourceLine})`;
    }
}

// ── Main Compressor ──

/**
 * Compress a raw VM trace into high-level semantic steps.
 *
 * Strategy: **1 step = 1 source-line visit.**
 * All micro-steps on the same source line are grouped together.
 * A new step begins only when the source line changes.
 * This gives roughly N steps for N lines of code,
 * plus a few extra for loop re-visits and function calls.
 *
 * Pure function. Deterministic. No side effects.
 *
 * @param trace     The full raw VM state trace (from buildTrace)
 * @param sourceMap sourceMap[pc] = source line number for that instruction
 * @returns         Compressed semantic steps
 */
export function compressTrace(
    trace: readonly VMState[],
    sourceMap: readonly number[],
): SemanticStep[] {
    if (trace.length === 0) return [];
    if (trace.length === 1) {
        return [{
            index: 0,
            sourceLine: sourceMap[trace[0]!.pc] ?? 0,
            semanticType: 'halt',
            summaryText: '— Program ended —',
            microStepRange: [0, 1],
            resultState: trace[0]!,
            variableChanges: new Map(),
            outputEmitted: [],
        }];
    }

    // Phase 1: Group by source line — cut only when line changes
    const groups: RawGroup[] = [];
    let currentGroup: RawGroup = {
        startIdx: 0,
        endIdx: 1,
        sourceLine: sourceMap[trace[0]!.pc] ?? 0,
        opcodes: [],
    };

    const firstInstr = getInstruction(trace[0]!);
    if (firstInstr) currentGroup.opcodes.push(firstInstr.opcode);

    // Track loop-back targets for loop detection
    const loopHeads = new Set<number>();

    for (let i = 1; i < trace.length; i++) {
        const prev = trace[i - 1]!;
        const curr = trace[i]!;
        const prevInstr = getInstruction(prev);
        if (!prevInstr) continue;

        const currLine = sourceMap[curr.pc] ?? 0;

        // Detect loop-back jumps for semantic type inference
        if (prevInstr.opcode === 'JUMP' && 'target' in prevInstr) {
            const target = (prevInstr as any).target as number;
            if (target <= prev.pc) {
                loopHeads.add(target);
            }
        }

        // Simple rule: cut when the source line changes (skip line 0 = internal)
        const shouldCut = currLine !== currentGroup.sourceLine && currLine !== 0;

        if (shouldCut) {
            currentGroup.endIdx = i;
            groups.push(currentGroup);
            currentGroup = {
                startIdx: i,
                endIdx: i + 1,
                sourceLine: currLine,
                opcodes: [],
            };
        } else {
            currentGroup.endIdx = i + 1;
        }

        const currInstr = getInstruction(curr);
        if (currInstr) currentGroup.opcodes.push(currInstr.opcode);
    }
    groups.push(currentGroup);

    // Phase 2: Convert groups to SemanticSteps
    const loopIterCounts = new Map<number, number>();
    const steps: SemanticStep[] = [];

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i]!;
        const initialState = trace[group.startIdx]!;
        const resultState = trace[Math.min(group.endIdx, trace.length) - 1]!;

        // Compute diffs
        const beforeBindings = getBindings(initialState);
        const afterBindings = getBindings(resultState);
        const variableChanges = diffBindings(beforeBindings, afterBindings);
        const outputEmitted = diffOutput(initialState.output, resultState.output);

        // Detect control flow
        let controlFlowInfo: { type: 'branch' | 'loop_check'; conditionResult: boolean; label: string } | undefined;
        let iterationNumber: number | undefined;

        if (group.opcodes.includes('JUMP_IF_FALSE') || group.opcodes.includes('JUMP_IF_TRUE')) {
            const isLoopHead = loopHeads.has(initialState.pc);

            // Determine branch result
            const lastIdx = group.endIdx - 1;
            const branchState = trace[lastIdx];
            const branchPrevState = lastIdx > 0 ? trace[lastIdx - 1] : undefined;
            let conditionResult = true;

            if (branchState && branchPrevState) {
                const branchInstr = getInstruction(branchPrevState);
                if (branchInstr?.opcode === 'JUMP_IF_FALSE') {
                    conditionResult = branchState.pc === branchPrevState.pc + 1;
                } else if (branchInstr?.opcode === 'JUMP_IF_TRUE') {
                    conditionResult = branchState.pc !== branchPrevState.pc + 1;
                }
            }

            if (isLoopHead) {
                const headPc = initialState.pc;
                const count = (loopIterCounts.get(headPc) ?? 0) + 1;
                loopIterCounts.set(headPc, count);
                iterationNumber = count;
                controlFlowInfo = {
                    type: 'loop_check',
                    conditionResult,
                    label: conditionResult ? 'continue' : 'exit',
                };
            } else {
                controlFlowInfo = {
                    type: 'branch',
                    conditionResult,
                    label: conditionResult ? 'taken' : 'not taken',
                };
            }
        }

        // Infer semantic type
        let semanticType = inferSemanticType(group.opcodes, controlFlowInfo ? { type: controlFlowInfo.type } : undefined);

        if (semanticType === 'loop_check' && controlFlowInfo && !controlFlowInfo.conditionResult) {
            semanticType = 'loop_exit';
        }

        const summaryText = buildSummaryText(
            semanticType,
            variableChanges,
            outputEmitted,
            controlFlowInfo,
            iterationNumber,
            group.sourceLine,
        );

        steps.push({
            index: i,
            sourceLine: group.sourceLine,
            semanticType,
            summaryText,
            microStepRange: [group.startIdx, group.endIdx],
            resultState,
            variableChanges,
            outputEmitted,
            controlFlow: controlFlowInfo,
            iterationNumber,
        });
    }

    return steps;
}

