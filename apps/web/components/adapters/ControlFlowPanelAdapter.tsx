"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ExplanationEvent } from "chronovm-explain";
import type { LoopTrackerState } from "../execution/LoopTracker";
import { usePanelMode } from "@/contexts/ModeContext";
import { PanelModeToggle } from "../PanelModeToggle";
import { EvalBubble } from "../execution/EvalBubble";
import { ControlFlowPanel } from "../execution/ControlFlowPanel";
import { LoopTracker } from "../execution/LoopTracker";

interface ControlFlowPanelAdapterProps {
    events: readonly ExplanationEvent[];
    loopState?: LoopTrackerState | null;
}

const crossfade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
};

/**
 * ControlFlowPanelAdapter — Mode-switchable control flow visualization.
 *
 * Learning: EvalBubble + ControlFlowPanel / LoopTracker
 * Pro:      Raw control flow events table
 */
export function ControlFlowPanelAdapter({ events, loopState }: ControlFlowPanelAdapterProps) {
    const { mode } = usePanelMode("controlFlow");

    return (
        <div>
            <div className="flex items-center justify-between mb-2 px-4 pt-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-purple)]/70 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-purple)]/60" />
                    Control Flow
                </h3>
                <PanelModeToggle panelId="controlFlow" />
            </div>

            <div className="px-4 pb-3">
                <AnimatePresence mode="wait">
                    {mode === "learning" ? (
                        <motion.div key="cf-learning" {...crossfade}>
                            <EvalBubble events={events} />
                            {loopState ? (
                                <LoopTracker state={loopState} />
                            ) : (
                                <ControlFlowPanel events={events} />
                            )}
                        </motion.div>
                    ) : (
                        <motion.div key="cf-pro" {...crossfade}>
                            <ProControlFlowTable events={events} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

/* ── Pro: Raw events table ── */

function ProControlFlowTable({ events }: { events: readonly ExplanationEvent[] }) {
    const cfEvents = events.filter(
        (e) => e.type === "ControlFlowDecision" || e.type.startsWith("Loop"),
    );

    if (cfEvents.length === 0) {
        return (
            <p className="text-[10px] text-[var(--text-secondary)] italic">
                No control-flow events at this step.
            </p>
        );
    }

    return (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <table className="w-full text-xs font-mono">
                <thead>
                    <tr className="bg-[var(--surface-raised)] text-[10px] text-[var(--text-secondary)]">
                        <th className="px-3 py-1 text-left font-semibold">Type</th>
                        <th className="px-3 py-1 text-left font-semibold">Details</th>
                    </tr>
                </thead>
                <tbody>
                    {cfEvents.map((evt, i) => (
                        <tr
                            key={i}
                            className="border-t border-[var(--border)]/50 hover:bg-[var(--surface-raised)]/50 transition-colors"
                        >
                            <td className="px-3 py-1 text-[var(--accent-purple)]">{evt.type}</td>
                            <td className="px-3 py-1 text-[var(--text-secondary)]">
                                {JSON.stringify(
                                    Object.fromEntries(
                                        Object.entries(evt).filter(([k]) => k !== "type"),
                                    ),
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
