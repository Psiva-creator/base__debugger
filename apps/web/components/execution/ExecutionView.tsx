"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { StepAnalysis } from "chronovm-analyze";
import type { VMState } from "chronovm-core";
import type { VariableHistoryEntry } from "./VariableCards";
import type { LoopTrackerState } from "./LoopTracker";
import { useMode } from "@/contexts/ModeContext";
import { MemoryStage } from "./MemoryStage";
import { EvalBubble } from "./EvalBubble";
import { ControlFlowPanel } from "./ControlFlowPanel";
import { LoopTracker } from "./LoopTracker";
import { ProView } from "../pro/ProView";

interface ExecutionViewProps {
    analysis: StepAnalysis;
    sentences: readonly string[];
    output: readonly string[];
    rawState: VMState;
    microStepIdx: number;
    totalMicroSteps: number;
    /** Per-variable history for change trail */
    variableHistory?: ReadonlyMap<string, readonly VariableHistoryEntry[]>;
    /** Stable display order */
    variableOrder?: readonly string[];
    /** Current semantic step index */
    currentStep?: number;
    /** Loop tracker state */
    loopState?: LoopTrackerState | null;
}

const crossfade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
};

/**
 * ExecutionView — Top-level orchestrator for the right panel.
 *
 * Branches on mode:
 *   Learning → MemoryStage + EvalBubble + ControlFlow + Narration
 *   Pro      → ProView (full-detail)
 */
export function ExecutionView({
    analysis,
    sentences,
    output,
    rawState,
    microStepIdx,
    totalMicroSteps,
    variableHistory,
    variableOrder,
    currentStep,
    loopState,
}: ExecutionViewProps) {
    const { mode } = useMode();
    const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

    return (
        <AnimatePresence mode="wait">
            {mode === "learning" ? (
                <motion.div key="learning-view" {...crossfade} className="h-full">
                    <LearningView
                        analysis={analysis}
                        sentences={sentences}
                        output={output}
                        variableHistory={variableHistory}
                        variableOrder={variableOrder}
                        currentStep={currentStep}
                        focusedNodeId={focusedNodeId}
                        onFocusVariable={setFocusedNodeId}
                        loopState={loopState}
                    />
                </motion.div>
            ) : (
                <motion.div key="pro-view" {...crossfade} className="h-full">
                    <ProView
                        analysis={analysis}
                        rawState={rawState}
                        microStepIdx={microStepIdx}
                        totalMicroSteps={totalMicroSteps}
                        output={output}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/* ── Learning Mode View (original layout) ── */

function LearningView({
    analysis,
    sentences,
    output,
    variableHistory,
    variableOrder,
    currentStep,
    focusedNodeId,
    onFocusVariable,
    loopState,
}: {
    analysis: StepAnalysis;
    sentences: readonly string[];
    output: readonly string[];
    variableHistory?: ReadonlyMap<string, readonly VariableHistoryEntry[]>;
    variableOrder?: readonly string[];
    currentStep?: number;
    focusedNodeId?: string | null;
    onFocusVariable?: (nodeId: string | null) => void;
    loopState?: LoopTrackerState | null;
}) {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Memory Visualization */}
            <div className="flex-1 overflow-auto p-4">
                <MemoryStage
                    analysis={analysis}
                    variableHistory={variableHistory}
                    variableOrder={variableOrder}
                    currentStep={currentStep}
                    focusedNodeId={focusedNodeId}
                    onFocusVariable={onFocusVariable}
                />
                <EvalBubble events={analysis.events} />
                {loopState ? (
                    <LoopTracker state={loopState} />
                ) : (
                    <ControlFlowPanel events={analysis.events} />
                )}
            </div>

            {/* Narration + Output */}
            <div className="border-t border-[var(--border)] bg-[var(--surface)] max-h-[28%] overflow-auto">
                {/* Output */}
                {output.length > 0 && (
                    <div className="px-4 py-2 border-b border-[var(--border)]">
                        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-green)] mb-1">
                            📤 Output
                        </h3>
                        <pre className="text-xs font-mono text-[var(--text-primary)] bg-[var(--background)] rounded-lg p-2 max-h-20 overflow-auto leading-relaxed">
                            {output.join("\n")}
                        </pre>
                    </div>
                )}

                {/* Narration */}
                <div className="px-4 py-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--accent-blue)] mb-1.5">
                        What Happened
                    </h3>
                    {sentences.length > 0 ? (
                        <ul className="space-y-0.5">
                            {sentences.map((s, i) => (
                                <li
                                    key={i}
                                    className="flex items-start gap-2 text-xs text-[var(--text-secondary)]"
                                >
                                    <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] text-[10px] font-bold font-mono mt-px">
                                        {analysis.step}
                                    </span>
                                    {s}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-[var(--text-secondary)] italic">
                            Nothing changed at this step.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
