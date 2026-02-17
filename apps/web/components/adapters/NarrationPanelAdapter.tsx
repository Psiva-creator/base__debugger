"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { StepAnalysis } from "chronovm-analyze";
import { usePanelMode } from "@/contexts/ModeContext";
import { PanelModeToggle } from "../PanelModeToggle";

interface NarrationPanelAdapterProps {
    analysis: StepAnalysis;
    sentences: readonly string[];
}

const crossfade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
};

/**
 * NarrationPanelAdapter — Mode-switchable narration display.
 *
 * Learning: "What Happened" human-readable sentences
 * Pro:      Raw ExplanationEvent[] + Insight[] + Plan[] dump
 */
export function NarrationPanelAdapter({ analysis, sentences }: NarrationPanelAdapterProps) {
    const { mode } = usePanelMode("narration");

    return (
        <div className="px-4 py-2">
            <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--accent-blue)] flex items-center gap-1.5">
                    {mode === "learning" ? "What Happened" : "Raw Analysis"}
                </h3>
                <PanelModeToggle panelId="narration" />
            </div>

            <AnimatePresence mode="wait">
                {mode === "learning" ? (
                    <motion.div key="narration-learning" {...crossfade}>
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
                    </motion.div>
                ) : (
                    <motion.div key="narration-pro" {...crossfade}>
                        <ProAnalysisDump analysis={analysis} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ── Pro: Raw analysis dump ── */

function ProAnalysisDump({ analysis }: { analysis: StepAnalysis }) {
    return (
        <div className="space-y-2 text-xs font-mono">
            {/* Events */}
            <details open>
                <summary className="cursor-pointer text-[var(--accent-purple)] font-semibold text-[10px] uppercase tracking-wider mb-1">
                    Events ({analysis.events.length})
                </summary>
                {analysis.events.length === 0 ? (
                    <span className="text-[var(--text-secondary)] italic text-[10px]">none</span>
                ) : (
                    <div className="space-y-0.5">
                        {analysis.events.map((evt, i) => (
                            <div
                                key={i}
                                className="px-2 py-0.5 rounded bg-[var(--surface-raised)] text-[10px] text-[var(--text-secondary)] truncate"
                            >
                                <span className="text-[var(--accent-purple)]">{evt.type}</span>{" "}
                                {JSON.stringify(
                                    Object.fromEntries(
                                        Object.entries(evt).filter(([k]) => k !== "type"),
                                    ),
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </details>

            {/* Insights */}
            <details>
                <summary className="cursor-pointer text-[var(--accent-cyan)] font-semibold text-[10px] uppercase tracking-wider mb-1">
                    Insights ({analysis.insights.length})
                </summary>
                {analysis.insights.length === 0 ? (
                    <span className="text-[var(--text-secondary)] italic text-[10px]">none</span>
                ) : (
                    <pre className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface-raised)] rounded p-2 overflow-auto max-h-32">
                        {JSON.stringify(analysis.insights, null, 2)}
                    </pre>
                )}
            </details>

            {/* Plans */}
            <details>
                <summary className="cursor-pointer text-[var(--accent-yellow)] font-semibold text-[10px] uppercase tracking-wider mb-1">
                    Plans ({analysis.plans.length})
                </summary>
                {analysis.plans.length === 0 ? (
                    <span className="text-[var(--text-secondary)] italic text-[10px]">none</span>
                ) : (
                    <pre className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface-raised)] rounded p-2 overflow-auto max-h-32">
                        {JSON.stringify(analysis.plans, null, 2)}
                    </pre>
                )}
            </details>
        </div>
    );
}
