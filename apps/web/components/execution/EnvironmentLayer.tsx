"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GraphNode } from "chronovm-graph";
import { spring, envAppear, highlightPulse } from "@/lib/motion";

interface EnvironmentLayerProps {
    nodes: readonly GraphNode[];
    addedIds: Set<string>;
    changedIds: Set<string>;
    edges: ReadonlyArray<{ from: string; to: string; label: string }>;
}

/** Individual environment card — memoized */
const EnvironmentCard = React.memo(function EnvironmentCard({
    node,
    isNew,
    isChanged,
    bindings,
}: {
    node: GraphNode;
    isNew: boolean;
    isChanged: boolean;
    bindings: ReadonlyArray<{ label: string; to: string }>;
}) {
    return (
        <motion.div
            layout
            layoutId={node.id}
            key={node.id}
            initial={envAppear.initial}
            animate={{
                ...envAppear.animate,
                ...(isChanged ? { boxShadow: highlightPulse.boxShadow } : {}),
            }}
            exit={envAppear.exit}
            transition={{
                layout: spring,
                ...(isChanged
                    ? { boxShadow: { duration: 0.6, repeat: 1, repeatType: "reverse" as const } }
                    : {}),
            }}
            className={`
                relative rounded-xl border px-4 py-3 min-w-[140px]
                bg-[var(--accent-blue)]/5 border-[var(--accent-blue)]/30
                backdrop-blur-sm
                ${isNew ? "ring-2 ring-[var(--accent-green)]/50" : ""}
            `}
            style={{
                background: "linear-gradient(135deg, rgba(122,162,247,0.08) 0%, rgba(122,162,247,0.02) 100%)",
                boxShadow: isNew ? undefined : "0 2px 12px rgba(0,0,0,0.2)",
            }}
        >
            {/* Scope badge */}
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-blue)] mb-2 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-blue)]/60" />
                Scope
            </div>

            {/* Bindings */}
            {bindings.length > 0 ? (
                <div className="space-y-1">
                    {bindings.map((b) => (
                        <div
                            key={b.label}
                            className="flex items-center gap-2 text-xs font-mono"
                        >
                            <span className="text-[var(--accent-purple)]">{b.label}</span>
                            <span className="text-[var(--text-secondary)]">→</span>
                            <span className="text-[var(--text-primary)] opacity-70 truncate">
                                {b.to}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-[10px] text-[var(--text-secondary)] italic">
                    empty scope
                </div>
            )}

            {/* Address */}
            <div className="text-[9px] text-[var(--text-secondary)] mt-2 font-mono opacity-40">
                {node.id}
            </div>
        </motion.div>
    );
});

/**
 * EnvironmentLayer — Renders environment-kind graph nodes as glass cards.
 * Each card shows its bindings (edges from this env).
 */
export function EnvironmentLayer({ nodes, addedIds, changedIds, edges }: EnvironmentLayerProps) {
    if (nodes.length === 0) return null;

    return (
        <div className="mb-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-blue)]/70 mb-2 flex items-center gap-1.5">
                <span>🔒</span> Environments
            </h4>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                <AnimatePresence mode="popLayout">
                    {nodes.map((node) => {
                        const bindings = edges
                            .filter((e) => e.from === node.id)
                            .map((e) => ({ label: e.label, to: e.to }));
                        return (
                            <EnvironmentCard
                                key={node.id}
                                node={node}
                                isNew={addedIds.has(node.id)}
                                isChanged={changedIds.has(node.id)}
                                bindings={bindings}
                            />
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}
