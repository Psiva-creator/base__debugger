import type { VMState } from 'chronovm-core';
import type { MemoryModel, MemoryDiff } from 'chronovm-model';
import type { MemoryGraph } from 'chronovm-graph';
import type { ExplanationEvent } from 'chronovm-explain';
import type { Insight } from 'chronovm-insight';
import type { ExplanationPlan } from 'chronovm-explain-ai';
import { buildMemoryModel, diffMemoryModels } from 'chronovm-model';
import { buildMemoryGraph } from 'chronovm-graph';
import { explainDiff } from 'chronovm-explain';
import { analyzeEvents } from 'chronovm-insight';
import { createExplanationPlans } from 'chronovm-explain-ai';

export type StepAnalysis = {
    readonly step: number;
    readonly memoryModel: MemoryModel;
    readonly graph: MemoryGraph;
    readonly diffFromPrevious: MemoryDiff | null;
    readonly events: readonly ExplanationEvent[];
    readonly insights: readonly Insight[];
    readonly plans: readonly ExplanationPlan[];
};

export function analyzeStep(
    trace: readonly VMState[],
    stepIndex: number,
): StepAnalysis {
    if (stepIndex < 0 || stepIndex >= trace.length) {
        throw new RangeError(
            `stepIndex ${stepIndex} out of bounds [0, ${trace.length - 1}]`,
        );
    }

    const currentState = trace[stepIndex]!;
    const memoryModel = buildMemoryModel(currentState);
    const graph = buildMemoryGraph(memoryModel);

    if (stepIndex === 0) {
        return {
            step: stepIndex,
            memoryModel,
            graph,
            diffFromPrevious: null,
            events: [],
            insights: [],
            plans: [],
        };
    }

    const previousState = trace[stepIndex - 1]!;
    const previousModel = buildMemoryModel(previousState);
    const previousGraph = buildMemoryGraph(previousModel);
    const diffFromPrevious = diffMemoryModels(previousModel, memoryModel);
    const events = [...explainDiff(diffFromPrevious, previousGraph, graph)];

    // ── Additional Control Flow Analysis ──
    const prevInstr = previousState.program[previousState.pc];
    if (prevInstr) {
        if (prevInstr.opcode === 'JUMP_IF_FALSE' || prevInstr.opcode === 'JUMP_IF_TRUE') {
            const branched = currentState.pc !== previousState.pc + 1;
            events.push({
                type: 'ControlFlowDecision',
                fromPc: previousState.pc,
                toPc: currentState.pc,
                condition: prevInstr.opcode === 'JUMP_IF_TRUE' ? branched : !branched,
                label: branched ? 'branch taken' : 'branch not taken',
            } as any);
        } else if (prevInstr.opcode === 'JUMP') {
            events.push({
                type: 'ControlFlowDecision',
                fromPc: previousState.pc,
                toPc: currentState.pc,
                label: 'jump',
            } as any);
        }
    }

    const insights = analyzeEvents(events);
    const plans = createExplanationPlans(insights);

    return {
        step: stepIndex,
        memoryModel,
        graph,
        diffFromPrevious,
        events,
        insights,
        plans,
    };
}
