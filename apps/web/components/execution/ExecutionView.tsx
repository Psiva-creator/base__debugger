"use client";

import { useState } from "react";
import type { StepAnalysis } from "chronovm-analyze";
import type { VMState } from "chronovm-core";
import type { VariableHistoryEntry } from "./VariableCards";
import type { LoopTrackerState } from "./LoopTracker";

import { MemoryPanelAdapter } from "../adapters/MemoryPanelAdapter";
import { ControlFlowPanelAdapter } from "../adapters/ControlFlowPanelAdapter";
import { VariablesPanelAdapter } from "../adapters/VariablesPanelAdapter";
import { StackPanelAdapter } from "../adapters/StackPanelAdapter";
import { InstructionPanelAdapter } from "../adapters/InstructionPanelAdapter";
import { NarrationPanelAdapter } from "../adapters/NarrationPanelAdapter";
import { OutputPanelAdapter } from "../adapters/OutputPanelAdapter";

interface ExecutionLayoutProps {
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
    /** Current source line (for instruction panel learning mode) */
    sourceLine?: number;
}

/**
 * ExecutionLayout — Stable grid layout for all panel adapters.
 *
 * Replaces the old ExecutionView which branched entirely on mode.
 * Each panel adapter is always mounted and independently manages
 * its own mode toggle + crossfade.
 *
 * Layout:
 *   ┌────────────────────────────────────────┐
 *   │ InstructionPanelAdapter (top strip)    │
 *   ├────────────────────────────────────────┤
 *   │ MemoryPanelAdapter (main area, flex-1) │
 *   ├────────────────────────────────────────┤
 *   │ ControlFlowPanelAdapter                │
 *   ├────────────────────────────────────────┤
 *   │ StackPanelAdapter                      │
 *   ├──────────────────────┬─────────────────┤
 *   │ OutputPanelAdapter   │ NarrationPanel  │
 *   └──────────────────────┴─────────────────┘
 */
export function ExecutionLayout({
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
    sourceLine,
}: ExecutionLayoutProps) {
    const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* ── Top: Instruction Panel ── */}
            <InstructionPanelAdapter
                rawState={rawState}
                microStepIdx={microStepIdx}
                totalMicroSteps={totalMicroSteps}
                sourceLine={sourceLine}
            />

            {/* ── Main: Memory Panel (flex-1) ── */}
            <MemoryPanelAdapter
                analysis={analysis}
                rawState={rawState}
                variableHistory={variableHistory}
                variableOrder={variableOrder}
                currentStep={currentStep}
                focusedNodeId={focusedNodeId}
                onFocusVariable={setFocusedNodeId}
            />

            {/* ── Control Flow ── */}
            <ControlFlowPanelAdapter
                events={analysis.events}
                loopState={loopState}
            />

            {/* ── Stack ── */}
            <StackPanelAdapter
                analysis={analysis}
                rawState={rawState}
            />

            {/* ── Bottom: Output + Narration ── */}
            <div className="border-t border-[var(--border)] bg-[var(--surface)] max-h-[28%] overflow-auto">
                <OutputPanelAdapter output={output} />
                <NarrationPanelAdapter
                    analysis={analysis}
                    sentences={sentences}
                />
            </div>
        </div>
    );
}

// ── Legacy export alias ──
/** @deprecated Use ExecutionLayout instead */
export const ExecutionView = ExecutionLayout;
