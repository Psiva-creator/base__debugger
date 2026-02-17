"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { VMState } from "chronovm-core";
import type { GraphNode } from "chronovm-graph";
import type { StepAnalysis } from "chronovm-analyze";
import { usePanelMode } from "@/contexts/ModeContext";
import { PanelModeToggle } from "../PanelModeToggle";
import { CallStackLayer } from "../execution/CallStackLayer";

interface StackPanelAdapterProps {
    analysis: StepAnalysis;
    rawState: VMState;
}

const crossfade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
};

/**
 * StackPanelAdapter — Mode-switchable stack visualization.
 *
 * Learning: CallStackLayer (simplified scope view)
 * Pro:      Raw callStack[] + operandStack[]
 */
export function StackPanelAdapter({ analysis, rawState }: StackPanelAdapterProps) {
    const { mode } = usePanelMode("stack");

    const envNodes = useMemo(
        () => analysis.graph.nodes.filter((n) => n.kind === "environment"),
        [analysis.graph.nodes],
    );

    const addedSet = useMemo(
        () => new Set(analysis.diffFromPrevious?.addedHeapNodes ?? []),
        [analysis.diffFromPrevious],
    );

    return (
        <div>
            <div className="flex items-center justify-between mb-2 px-4 pt-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-yellow)]/70 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-yellow)]/60" />
                    Stack
                </h3>
                <PanelModeToggle panelId="stack" />
            </div>

            <div className="px-4 pb-3">
                <AnimatePresence mode="wait">
                    {mode === "learning" ? (
                        <motion.div key="stack-learning" {...crossfade}>
                            <CallStackLayer envNodes={envNodes} addedIds={addedSet} />
                        </motion.div>
                    ) : (
                        <motion.div key="stack-pro" {...crossfade}>
                            <ProStackView rawState={rawState} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

/* ── Pro: Raw stacks ── */

function ProStackView({ rawState }: { rawState: VMState }) {
    return (
        <div className="space-y-3">
            {/* Operand Stack */}
            <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-purple)]/70 mb-1.5 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-purple)]/60" />
                    Operand Stack
                </h4>
                <div className="flex flex-wrap gap-1">
                    {rawState.operandStack.length === 0 ? (
                        <span className="text-[10px] text-[var(--text-secondary)] italic">empty</span>
                    ) : (
                        [...rawState.operandStack].reverse().map((val, i) => (
                            <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-[var(--accent-purple)]/8 border border-[var(--accent-purple)]/15 text-[11px] font-mono text-[var(--text-primary)]"
                            >
                                {String(val)}
                            </span>
                        ))
                    )}
                </div>
            </div>

            {/* Call Stack */}
            <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-red)]/70 mb-1.5 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-red)]/60" />
                    Call Stack
                </h4>
                <div className="flex flex-col gap-0.5">
                    {rawState.callStack.length === 0 ? (
                        <span className="text-[10px] text-[var(--text-secondary)] italic">global</span>
                    ) : (
                        [...rawState.callStack].reverse().map((frame, i) => (
                            <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-[var(--accent-red)]/8 border border-[var(--accent-red)]/15 text-[10px] font-mono text-[var(--text-primary)]"
                            >
                                PC:{(frame as any).returnAddress ?? "?"} Env:{(frame as any).environment ?? "?"}
                            </span>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
