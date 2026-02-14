"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GraphNode } from "chronovm-graph";
import { stackSlideIn, spring } from "@/lib/motion";

interface CallStackLayerProps {
    /** Active environment nodes representing the current call stack (most recent last) */
    envNodes: readonly GraphNode[];
    addedIds: Set<string>;
}

/** Individual call stack entry — memoized */
const CallStackEntry = React.memo(function CallStackEntry({
    node,
    isNew,
    depth,
}: {
    node: GraphNode;
    isNew: boolean;
    depth: number;
}) {
    return (
        <motion.div
            layout
            layoutId={`stack-${node.id}`}
            key={node.id}
            initial={stackSlideIn.initial}
            animate={stackSlideIn.animate}
            exit={stackSlideIn.exit}
            transition={{ layout: spring }}
            className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono
                border border-[var(--border)]/50
                backdrop-blur-sm
                ${isNew
                    ? "bg-[var(--accent-green)]/10 border-[var(--accent-green)]/40 text-[var(--accent-green)]"
                    : "bg-[var(--surface-raised)]/80 text-[var(--text-secondary)]"
                }
            `}
            style={{
                background: isNew
                    ? "linear-gradient(135deg, rgba(158,206,106,0.1) 0%, rgba(158,206,106,0.03) 100%)"
                    : "linear-gradient(135deg, rgba(35,36,56,0.8) 0%, rgba(35,36,56,0.4) 100%)",
            }}
        >
            <span className="text-[var(--text-secondary)]/50 select-none">
                {depth}
            </span>
            <span className="truncate">{node.label}</span>
        </motion.div>
    );
});

/**
 * CallStackLayer — Displays active scopes as a vertical stack.
 * New environments slide in from the bottom, destroyed ones fade out.
 */
export function CallStackLayer({ envNodes, addedIds }: CallStackLayerProps) {
    if (envNodes.length === 0) return null;

    return (
        <div className="mb-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-yellow)]/70 mb-2 flex items-center gap-1.5">
                <span>📚</span> Call Stack
            </h4>
            <div className="flex flex-col gap-1">
                <AnimatePresence mode="popLayout">
                    {envNodes.map((node, i) => (
                        <CallStackEntry
                            key={node.id}
                            node={node}
                            isNew={addedIds.has(node.id)}
                            depth={i}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
