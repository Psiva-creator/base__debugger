"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gentleSpring } from "@/lib/motion";

/* ── Types ── */

export interface LoopIteration {
    readonly number: number;
    readonly loopVar?: { name: string; value: string };
    readonly output: readonly string[];
}

export interface LoopTrackerState {
    readonly sourceLine: number;
    readonly label: string;
    readonly status: "active" | "exited";
    readonly iterations: readonly LoopIteration[];
    readonly currentIteration: number;
}

interface LoopTrackerProps {
    state: LoopTrackerState;
}

const COLLAPSE_THRESHOLD = 6;

/**
 * LoopTracker — Narrative-driven loop visualization.
 *
 * Shows:
 *  ├── Loop header (while condition)
 *  ├── Iteration timeline with checkmarks
 *  ├── Variable trail (compact value history)
 *  └── Completion footer
 *
 * Collapses middle iterations for long loops (>6).
 */
export function LoopTracker({ state }: LoopTrackerProps) {
    const { label, status, iterations, currentIteration } = state;

    // Determine which rows to show (collapsing logic)
    const { visibleRows, collapsedCount } = useMemo(() => {
        if (iterations.length <= COLLAPSE_THRESHOLD) {
            return { visibleRows: iterations, collapsedCount: 0 };
        }
        // Show first 2, last 2 completed + current
        const first2 = iterations.slice(0, 2);
        const last2Completed = iterations.slice(
            Math.max(2, iterations.length - 3),
            iterations.length - 1
        );
        const current = iterations[iterations.length - 1];
        const collapsed = iterations.length - first2.length - last2Completed.length - (current ? 1 : 0);

        const visible = [
            ...first2,
            ...(collapsed > 0 ? [{ number: -1, output: [] as string[] } as LoopIteration] : []),
            ...last2Completed,
            ...(current ? [current] : []),
        ];

        return { visibleRows: visible, collapsedCount: Math.max(0, collapsed) };
    }, [iterations]);

    // Variable trail: extract all loop var values
    const variableTrail = useMemo(() => {
        const values: string[] = [];
        for (const iter of iterations) {
            if (iter.loopVar) values.push(iter.loopVar.value);
        }
        return values;
    }, [iterations]);

    const loopVarName = iterations[0]?.loopVar?.name;

    return (
        <div className="mt-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-purple)]/70 mb-3 flex items-center gap-1.5">
                <span>⟳</span> Loop Tracker
            </h4>

            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={gentleSpring}
                className="rounded-2xl border px-5 py-4 backdrop-blur-sm"
                style={{
                    background:
                        "linear-gradient(135deg, rgba(187,154,247,0.05) 0%, rgba(187,154,247,0.01) 100%)",
                    borderColor: status === "exited"
                        ? "rgba(158,206,106,0.15)"
                        : "rgba(187,154,247,0.12)",
                    boxShadow:
                        "0 4px 16px rgba(187,154,247,0.03), 0 8px 24px rgba(0,0,0,0.1)",
                }}
            >
                {/* Loop Header */}
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-[var(--accent-purple)] text-sm font-semibold">
                        {status === "exited" ? "✓" : "⟳"}
                    </span>
                    <span className="text-xs font-mono text-[var(--text-primary)]">
                        {label}
                    </span>
                    {status === "active" && (
                        <motion.span
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="ml-auto text-[9px] font-semibold text-[var(--accent-purple)]"
                        >
                            running
                        </motion.span>
                    )}
                </div>

                {/* Iteration Timeline */}
                <div className="flex flex-col gap-0.5 mb-3">
                    <AnimatePresence mode="popLayout">
                        {visibleRows.map((iter) => {
                            if (iter.number === -1) {
                                // Collapsed placeholder
                                return (
                                    <motion.div
                                        key="collapsed"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex items-center gap-2 px-2 py-1"
                                    >
                                        <span className="text-[9px] text-[var(--text-secondary)] opacity-50 italic">
                                            ··· {collapsedCount} more iterations ···
                                        </span>
                                    </motion.div>
                                );
                            }

                            const isCurrent = iter.number === currentIteration && status === "active";
                            const isCompleted = iter.number < currentIteration || status === "exited";

                            return (
                                <motion.div
                                    key={`iter-${iter.number}`}
                                    layout
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{
                                        layout: gentleSpring,
                                        opacity: { duration: 0.15 },
                                    }}
                                    className={`
                                        flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-mono
                                        transition-all duration-200
                                        ${isCurrent
                                            ? "bg-[var(--accent-blue)]/8 border-l-2 border-[var(--accent-blue)]"
                                            : ""
                                        }
                                        ${isCompleted ? "opacity-60" : ""}
                                    `}
                                >
                                    {/* Iteration number */}
                                    <span className={`
                                        flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold
                                        ${isCurrent
                                            ? "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]"
                                            : isCompleted
                                                ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]"
                                                : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
                                        }
                                    `}>
                                        {iter.number}
                                    </span>

                                    {/* Loop variable value */}
                                    {iter.loopVar && (
                                        <span className="text-[var(--text-secondary)]">
                                            {iter.loopVar.name} = <span className="text-[var(--text-primary)]">{iter.loopVar.value}</span>
                                        </span>
                                    )}

                                    {/* Status indicator */}
                                    <span className="ml-auto flex-shrink-0">
                                        {isCurrent ? (
                                            <motion.span
                                                initial={{ scale: 0.5 }}
                                                animate={{ scale: 1 }}
                                                className="text-[var(--accent-blue)] text-[10px]"
                                            >
                                                ◉
                                            </motion.span>
                                        ) : isCompleted ? (
                                            <motion.span
                                                initial={{ opacity: 0, scale: 0.5 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="text-[var(--accent-green)] text-[10px]"
                                            >
                                                ✓
                                            </motion.span>
                                        ) : null}
                                    </span>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* Variable Trail */}
                {loopVarName && variableTrail.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap px-1 mb-2">
                        <span className="text-[9px] font-semibold text-[var(--text-secondary)] mr-1">
                            {loopVarName}:
                        </span>
                        {variableTrail.map((val, i) => {
                            const isLast = i === variableTrail.length - 1;
                            // Collapse if trail is very long
                            if (variableTrail.length > 8 && i >= 2 && i < variableTrail.length - 2) {
                                if (i === 2) {
                                    return (
                                        <span key="ellipsis" className="flex items-center gap-1">
                                            <span className="text-[8px] text-[var(--text-secondary)] opacity-30">→</span>
                                            <span className="text-[9px] text-[var(--text-secondary)] opacity-40">...</span>
                                        </span>
                                    );
                                }
                                return null;
                            }
                            return (
                                <span key={i} className="flex items-center gap-1">
                                    {i > 0 && (
                                        <span className="text-[8px] text-[var(--text-secondary)] opacity-30">→</span>
                                    )}
                                    <motion.span
                                        initial={isLast ? { scale: 0.7, opacity: 0 } : undefined}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                        className={`text-[10px] font-mono ${isLast
                                            ? "text-[var(--text-primary)] font-semibold bg-[var(--accent-purple)]/10 px-1.5 py-0.5 rounded"
                                            : "text-[var(--text-secondary)] opacity-50"
                                            }`}
                                    >
                                        {val}
                                    </motion.span>
                                </span>
                            );
                        })}
                    </div>
                )}

                {/* Completion Footer */}
                {status === "exited" && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[10px] text-[var(--accent-green)] font-semibold pt-2 border-t border-[var(--accent-green)]/10"
                    >
                        Loop completed after {iterations.length} iteration{iterations.length !== 1 ? "s" : ""}.
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}
