"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { StepAnalysis } from "chronovm-analyze";
import type { VMState } from "chronovm-core";
import type { VariableHistoryEntry } from "../execution/VariableCards";
import { usePanelMode } from "@/contexts/ModeContext";
import { PanelModeToggle } from "../PanelModeToggle";
import { MemoryStage } from "../execution/MemoryStage";
import { FullMemoryGraph } from "../pro/FullMemoryGraph";

interface MemoryPanelAdapterProps {
    analysis: StepAnalysis;
    rawState: VMState;
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
 * MemoryPanelAdapter — Mode-switchable memory visualization.
 *
 * Learning: MemoryStage (VariableCards + HeapLayer)
 * Pro:      FullMemoryGraph (all nodes + edges + bindings)
 */
export function MemoryPanelAdapter({
    analysis,
    rawState,
    variableHistory,
    variableOrder,
    currentStep,
    focusedNodeId,
    onFocusVariable,
}: MemoryPanelAdapterProps) {
    const { mode } = usePanelMode("memory");

    return (
        <div className="flex-1 overflow-auto p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-blue)]/70 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-blue)]/60" />
                    Memory
                </h3>
                <PanelModeToggle panelId="memory" />
            </div>

            <AnimatePresence mode="wait">
                {mode === "learning" ? (
                    <motion.div key="memory-learning" {...crossfade}>
                        <MemoryStage
                            analysis={analysis}
                            variableHistory={variableHistory}
                            variableOrder={variableOrder}
                            currentStep={currentStep}
                            focusedNodeId={focusedNodeId}
                            onFocusVariable={onFocusVariable}
                        />
                    </motion.div>
                ) : (
                    <motion.div key="memory-pro" {...crossfade}>
                        <FullMemoryGraph analysis={analysis} rawState={rawState} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
