"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ExplanationEvent } from "chronovm-explain";
import { evalBubbleAppear, resultBadgeAppear, gentleSpring } from "@/lib/motion";

interface EvalBubbleProps {
    events: readonly ExplanationEvent[];
}

/**
 * EvalBubble — Cinematic floating evaluation bubble.
 *
 * Shows the temporary condition check (e.g. `x == 2 → True`)
 * when a ControlFlowDecision event with a condition is present.
 *
 * Design: Glass card, amber "Ephemeral" tag, green/red result badge.
 */
export function EvalBubble({ events }: EvalBubbleProps) {
    const decision = useMemo(() => {
        for (const evt of events) {
            if (evt.type === "ControlFlowDecision" && "condition" in evt) {
                return evt as ExplanationEvent & {
                    type: "ControlFlowDecision";
                    condition: boolean;
                    label: string;
                    fromPc: number;
                    toPc: number;
                };
            }
        }
        return null;
    }, [events]);

    if (!decision) return null;

    const conditionMet = decision.condition;

    return (
        <div className="mt-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-yellow)]/70 mb-3 flex items-center gap-1.5">
                <span>⚡</span> Temporary Evaluation
            </h4>

            <AnimatePresence mode="wait">
                <motion.div
                    key={`eval-${decision.fromPc}-${decision.toPc}`}
                    initial={evalBubbleAppear.initial}
                    animate={evalBubbleAppear.animate}
                    exit={evalBubbleAppear.exit}
                    transition={gentleSpring}
                    className="relative rounded-2xl border px-5 py-4 backdrop-blur-sm"
                    style={{
                        background:
                            "linear-gradient(135deg, rgba(224,175,104,0.06) 0%, rgba(224,175,104,0.01) 100%)",
                        borderColor: "rgba(224,175,104,0.15)",
                        boxShadow:
                            "0 4px 16px rgba(224,175,104,0.04), 0 8px 24px rgba(0,0,0,0.12)",
                    }}
                >
                    {/* Ephemeral tag */}
                    <div className="ephemeral-tag">Ephemeral</div>

                    {/* Expression */}
                    <div className="flex items-center gap-3 mt-1">
                        <span className="font-mono text-sm font-semibold text-[var(--text-primary)] bg-[var(--surface-raised)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
                            {decision.label === "branch taken"
                                ? "condition"
                                : "condition"}
                        </span>
                        <span className="font-mono text-xs text-[var(--text-secondary)]">
                            →
                        </span>
                        <span className="font-mono text-sm font-medium text-[var(--accent-blue)] bg-[var(--accent-blue)]/8 px-3 py-1.5 rounded-lg border border-[var(--accent-blue)]/15">
                            PC {decision.fromPc} → {decision.toPc}
                        </span>
                    </div>

                    {/* Result */}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--border)]/30">
                        <motion.div
                            initial={resultBadgeAppear.initial}
                            animate={resultBadgeAppear.animate}
                            transition={{
                                ...gentleSpring,
                                delay: 0.3,
                            }}
                            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-lg border ${conditionMet
                                    ? "text-[var(--accent-green)] bg-[var(--accent-green)]/8 border-[var(--accent-green)]/20"
                                    : "text-[var(--accent-red)] bg-[var(--accent-red)]/8 border-[var(--accent-red)]/20"
                                }`}
                        >
                            {/* Checkmark or X */}
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                {conditionMet ? (
                                    <polyline points="20 6 9 17 4 12" />
                                ) : (
                                    <>
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </>
                                )}
                            </svg>
                            {conditionMet ? "True" : "False"}
                        </motion.div>

                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.3 }}
                            className="text-xs text-[var(--text-secondary)]"
                        >
                            {conditionMet
                                ? "Condition satisfied — entering block"
                                : "Condition not met — skipping block"}
                        </motion.span>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
