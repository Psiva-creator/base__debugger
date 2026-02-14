"use client";

import { useMemo } from "react";
import type { StepAnalysis } from "chronovm-analyze";
import { HeapLayer } from "./HeapLayer";
import { VariableCards, type VariableHistoryEntry } from "./VariableCards";

interface MemoryStageProps {
    analysis: StepAnalysis;
    /** Per-variable history for change trail */
    variableHistory?: ReadonlyMap<string, readonly VariableHistoryEntry[]>;
    /** Stable display order */
    variableOrder?: readonly string[];
    /** Current semantic step index */
    currentStep?: number;
    /** Currently focused variable target for HeapLayer highlight */
    focusedNodeId?: string | null;
    /** Callback when variable is clicked */
    onFocusVariable?: (nodeId: string | null) => void;
}

/**
 * MemoryStage — The animated memory visualization container.
 *
 * Structure:
 *   MemoryStage (relative, overflow-visible)
 *     ├── VariableCards (interactive variable → value cards)
 *     └── HeapLayer (non-primitive nodes: objects, lists, functions)
 */
export function MemoryStage({
    analysis,
    variableHistory,
    variableOrder,
    currentStep,
    focusedNodeId,
    onFocusVariable,
}: MemoryStageProps) {
    const { graph, diffFromPrevious, events } = analysis;

    const addedSet = useMemo(
        () => new Set(diffFromPrevious?.addedHeapNodes ?? []),
        [diffFromPrevious]
    );

    const changedSet = useMemo(
        () =>
            new Set([
                ...(diffFromPrevious?.changedHeapNodes ?? []),
                ...(diffFromPrevious?.addedBindings?.map((b) => b.env) ?? []),
                ...(diffFromPrevious?.changedBindings?.map((b) => b.env) ?? []),
            ]),
        [diffFromPrevious]
    );

    // Reference target IDs: existing nodes that gained a new binding this step
    const referenceTargetIds = useMemo(() => {
        const targets = new Set<string>();
        if (!events) return targets;
        for (const evt of events) {
            if (
                (evt.type === "VariableBound" || evt.type === "VariableRebound") &&
                "address" in evt
            ) {
                if (!addedSet.has((evt as any).address ?? (evt as any).to)) {
                    targets.add((evt as any).address ?? (evt as any).to);
                }
            }
        }
        return targets;
    }, [events, addedSet]);

    return (
        <div className="relative w-full min-h-[200px]">
            {/* Interactive Variable Cards */}
            <VariableCards
                nodes={graph.nodes}
                edges={graph.edges}
                addedIds={addedSet}
                changedIds={changedSet}
                variableHistory={variableHistory}
                variableOrder={variableOrder}
                currentStep={currentStep}
                onFocusVariable={onFocusVariable ?? undefined}
                focusedNodeId={focusedNodeId}
            />

            {/* Remaining Heap Objects */}
            <HeapLayer
                nodes={graph.nodes}
                addedIds={addedSet}
                changedIds={changedSet}
                referenceTargetIds={referenceTargetIds}
                events={events}
                focusedNodeId={focusedNodeId}
            />
        </div>
    );
}
