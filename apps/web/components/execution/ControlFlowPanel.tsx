"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ExplanationEvent } from "chronovm-explain";
import { flowCardAppear, gentleSpring } from "@/lib/motion";

interface ControlFlowPanelProps {
    events: readonly ExplanationEvent[];
}

/**
 * ControlFlowPanel — Animated neon control flow path.
 *
 * Shows the execution path when a ControlFlowDecision event is present:
 *   [Condition] →→→ [Enter Block] →→→ [Next Op]
 *
 * The arrows use CSS-animated gradient tracks for the neon streaming effect.
 */
export function ControlFlowPanel({ events }: ControlFlowPanelProps) {
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

    // Derive variable binding info for the last node label
    const boundVar = useMemo(() => {
        for (const evt of events) {
            if (evt.type === "VariableBound") {
                return (evt as any).name as string;
            }
            if (evt.type === "VariableRebound") {
                return (evt as any).name as string;
            }
        }
        return null;
    }, [events]);

    if (!decision) return null;

    const conditionMet = decision.condition;

    return (
        <div className="mt-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-purple)]/70 mb-3 flex items-center gap-1.5">
                <span>🔀</span> Control Flow
            </h4>

            <AnimatePresence mode="wait">
                <motion.div
                    key={`flow-${decision.fromPc}-${decision.toPc}`}
                    initial={flowCardAppear.initial}
                    animate={flowCardAppear.animate}
                    exit={flowCardAppear.exit}
                    transition={gentleSpring}
                    className="rounded-2xl border px-5 py-4 backdrop-blur-sm"
                    style={{
                        background:
                            "linear-gradient(135deg, rgba(187,154,247,0.05) 0%, rgba(187,154,247,0.01) 100%)",
                        borderColor: "rgba(187,154,247,0.12)",
                        boxShadow:
                            "0 4px 16px rgba(187,154,247,0.03), 0 8px 24px rgba(0,0,0,0.1)",
                    }}
                >
                    {/* Flow path */}
                    <div className="flex items-center gap-0 overflow-x-auto">
                        {/* Node 1: Condition */}
                        <FlowNode
                            label={`PC ${decision.fromPc}`}
                            sublabel="Evaluate"
                            color="pink"
                        />

                        {/* Arrow 1: with True/False badge */}
                        <FlowArrow
                            badge={conditionMet ? "✓ True" : "✗ False"}
                            badgeColor={conditionMet ? "green" : "red"}
                            delay={0}
                        />

                        {/* Node 2: Enter/Skip */}
                        <FlowNode
                            label={conditionMet ? "Enter" : "Skip"}
                            sublabel={conditionMet ? "Block" : "Block"}
                            color={conditionMet ? "green" : "red"}
                        />

                        {/* Arrow 2 */}
                        <FlowArrow delay={0.3} />

                        {/* Node 3: Assignment or target */}
                        <FlowNode
                            label={
                                boundVar
                                    ? `${boundVar} = ...`
                                    : `PC ${decision.toPc}`
                            }
                            sublabel={boundVar ? "Assign" : "Continue"}
                            color="blue"
                        />
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

/* ── Sub-components ── */

function FlowNode({
    label,
    sublabel,
    color,
}: {
    label: string;
    sublabel: string;
    color: "pink" | "green" | "red" | "blue";
}) {
    const colors = {
        pink: {
            bg: "rgba(244,114,182,0.08)",
            border: "rgba(244,114,182,0.2)",
            text: "var(--accent-red)",
        },
        green: {
            bg: "rgba(158,206,106,0.08)",
            border: "rgba(158,206,106,0.2)",
            text: "var(--accent-green)",
        },
        red: {
            bg: "rgba(247,118,142,0.08)",
            border: "rgba(247,118,142,0.2)",
            text: "var(--accent-red)",
        },
        blue: {
            bg: "rgba(122,162,247,0.08)",
            border: "rgba(122,162,247,0.2)",
            text: "var(--accent-blue)",
        },
    };

    const c = colors[color];

    return (
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div
                className="px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold text-center border"
                style={{
                    background: c.bg,
                    borderColor: c.border,
                    color: c.text,
                }}
            >
                {label}
            </div>
            <span className="text-[8px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]/50">
                {sublabel}
            </span>
        </div>
    );
}

function FlowArrow({
    badge,
    badgeColor,
    delay = 0,
}: {
    badge?: string;
    badgeColor?: "green" | "red";
    delay?: number;
}) {
    return (
        <div className="flex items-center relative mx-1.5 flex-shrink-0" style={{ width: 56 }}>
            {/* Track */}
            <div
                className="flow-arrow-track w-full h-[2px] rounded-full"
                style={{
                    background: "rgba(187,154,247,0.1)",
                    animationDelay: `${delay}s`,
                }}
            />

            {/* Arrow head */}
            <div
                className="flex-shrink-0"
                style={{
                    width: 0,
                    height: 0,
                    borderTop: "4px solid transparent",
                    borderBottom: "4px solid transparent",
                    borderLeft: "6px solid rgba(187,154,247,0.6)",
                }}
            />

            {/* Optional badge */}
            {badge && (
                <span
                    className={`absolute -top-[18px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold uppercase tracking-wide px-1.5 py-[1px] rounded ${badgeColor === "green"
                            ? "text-[var(--accent-green)] bg-[var(--accent-green)]/8 border border-[var(--accent-green)]/15"
                            : "text-[var(--accent-red)] bg-[var(--accent-red)]/8 border border-[var(--accent-red)]/15"
                        }`}
                >
                    {badge}
                </span>
            )}
        </div>
    );
}
