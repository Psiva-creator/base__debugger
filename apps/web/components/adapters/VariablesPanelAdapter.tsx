"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { StepAnalysis } from "chronovm-analyze";
import type { GraphNode, GraphEdge } from "chronovm-graph";
import type { VariableHistoryEntry } from "../execution/VariableCards";
import { usePanelMode } from "@/contexts/ModeContext";
import { PanelModeToggle } from "../PanelModeToggle";
import { VariableCards } from "../execution/VariableCards";

interface VariablesPanelAdapterProps {
    analysis: StepAnalysis;
    variableHistory?: ReadonlyMap<string, readonly VariableHistoryEntry[]>;
    variableOrder?: readonly string[];
    currentStep?: number;
    focusedNodeId?: string | null;
    onFocusVariable?: (nodeId: string | null) => void;
}

const crossfade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
};

/**
 * VariablesPanelAdapter — Mode-switchable variables visualization.
 *
 * Learning: VariableCards (interactive glassmorphism cards)
 * Pro:      Raw bindings table (env → name → address → value)
 */
export function VariablesPanelAdapter({
    analysis,
    variableHistory,
    variableOrder,
    currentStep,
    focusedNodeId,
    onFocusVariable,
}: VariablesPanelAdapterProps) {
    const { mode } = usePanelMode("variables");
    const { graph, diffFromPrevious } = analysis;

    const addedSet = useMemo(
        () => new Set(diffFromPrevious?.addedHeapNodes ?? []),
        [diffFromPrevious],
    );
    const changedSet = useMemo(
        () =>
            new Set([
                ...(diffFromPrevious?.changedHeapNodes ?? []),
                ...(diffFromPrevious?.addedBindings?.map((b) => b.env) ?? []),
                ...(diffFromPrevious?.changedBindings?.map((b) => b.env) ?? []),
            ]),
        [diffFromPrevious],
    );

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-blue)]/70 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-blue)]/60" />
                    Variables
                </h3>
                <PanelModeToggle panelId="variables" />
            </div>

            <AnimatePresence mode="wait">
                {mode === "learning" ? (
                    <motion.div key="vars-learning" {...crossfade}>
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
                    </motion.div>
                ) : (
                    <motion.div key="vars-pro" {...crossfade}>
                        <ProBindingsTable
                            nodes={graph.nodes}
                            edges={graph.edges}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ── Pro: Raw bindings table ── */

function ProBindingsTable({
    nodes,
    edges,
}: {
    nodes: readonly GraphNode[];
    edges: readonly GraphEdge[];
}) {
    // Build variable → value from env edges + primitive nodes
    const bindings = useMemo(() => {
        const result: { name: string; nodeId: string; value: string; kind: string }[] = [];
        for (const edge of edges) {
            const target = nodes.find((n) => n.id === edge.to);
            if (target) {
                result.push({
                    name: edge.label,
                    nodeId: target.id,
                    value: target.label,
                    kind: target.kind,
                });
            }
        }
        return result;
    }, [nodes, edges]);

    if (bindings.length === 0) {
        return (
            <p className="text-[10px] text-[var(--text-secondary)] italic">
                No variable bindings at this step.
            </p>
        );
    }

    return (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <table className="w-full text-xs font-mono">
                <thead>
                    <tr className="bg-[var(--surface-raised)] text-[10px] text-[var(--text-secondary)]">
                        <th className="px-3 py-1 text-left font-semibold">Name</th>
                        <th className="px-3 py-1 text-left font-semibold">Address</th>
                        <th className="px-3 py-1 text-left font-semibold">Value</th>
                        <th className="px-3 py-1 text-left font-semibold">Kind</th>
                    </tr>
                </thead>
                <tbody>
                    {bindings.map((b) => (
                        <tr
                            key={`${b.name}-${b.nodeId}`}
                            className="border-t border-[var(--border)]/50 hover:bg-[var(--surface-raised)]/50 transition-colors"
                        >
                            <td className="px-3 py-1 text-[var(--accent-purple)]">{b.name}</td>
                            <td className="px-3 py-1 text-[var(--text-secondary)]">@{b.nodeId}</td>
                            <td className="px-3 py-1 text-[var(--accent-blue)]">{b.value}</td>
                            <td className="px-3 py-1 text-[var(--text-secondary)] opacity-60">{b.kind}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
