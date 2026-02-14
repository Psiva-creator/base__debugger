"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GraphEdge } from "chronovm-graph";
import { magnetSnap, arrowAppear, gentleSpring } from "@/lib/motion";

interface ArrowLayerProps {
    edges: readonly GraphEdge[];
    nodeCount: number;
    addedSet: Set<string>;
}

/** Individual arrow/connection indicator — memoized */
const ArrowEntry = React.memo(function ArrowEntry({
    edge,
    edgeId,
    isNew,
}: {
    edge: GraphEdge;
    edgeId: string;
    isNew: boolean;
}) {
    return (
        <motion.div
            key={edgeId}
            layoutId={edgeId}
            initial={arrowAppear.initial}
            animate={{
                ...arrowAppear.animate,
                ...(isNew
                    ? {
                        boxShadow: [
                            "0 0 0 0 rgba(122, 162, 247, 0)",
                            "0 0 6px 2px rgba(122, 162, 247, 0.25)",
                            "0 0 0 0 rgba(122, 162, 247, 0)",
                        ],
                    }
                    : {}),
            }}
            exit={arrowAppear.exit}
            transition={isNew ? magnetSnap : gentleSpring}
            className={`
                flex items-center gap-2 text-xs font-mono py-1 px-2.5 rounded-lg
                transition-colors
                ${isNew
                    ? "bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/25"
                    : "hover:bg-[var(--surface-raised)]/50"
                }
            `}
        >
            {/* From node */}
            <span className="text-[var(--accent-blue)] truncate max-w-[80px]">
                {edge.from}
            </span>

            {/* Arrow with label */}
            <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                <svg width="16" height="8" viewBox="0 0 16 8" className="opacity-50">
                    <line
                        x1="0" y1="4" x2="12" y2="4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                    <polyline
                        points="10,1 14,4 10,7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
                <span className="text-[var(--accent-purple)] text-[11px]">
                    {edge.label}
                </span>
            </span>

            {/* To node */}
            <span className="text-[var(--accent-cyan)] truncate max-w-[80px]">
                {edge.to}
            </span>
        </motion.div>
    );
});

/**
 * ArrowLayer — Animated connection indicators between nodes.
 *
 * Renders edge labels with cinematic enter/exit animations.
 * New edges use magnetSnap spring for snappy binding feel.
 * Existing edges use gentleSpring for smooth layout transitions.
 */
export function ArrowLayer({ edges, nodeCount, addedSet }: ArrowLayerProps) {
    if (edges.length === 0) return null;

    return (
        <div className="mt-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]/70 mb-2 flex items-center gap-1.5">
                <span>🔗</span> Connections
            </h4>
            <div
                className="space-y-0.5 rounded-xl p-2 border border-[var(--border)]/30"
                style={{
                    background: "linear-gradient(135deg, rgba(26,27,46,0.6) 0%, rgba(26,27,46,0.3) 100%)",
                    backdropFilter: "blur(4px)",
                }}
            >
                <AnimatePresence mode="popLayout">
                    {edges.map((edge) => {
                        const edgeId = `${edge.from}→${edge.to}:${edge.label}`;
                        const isNew =
                            addedSet.has(edge.from) ||
                            addedSet.has(edge.to);
                        return (
                            <ArrowEntry
                                key={edgeId}
                                edge={edge}
                                edgeId={edgeId}
                                isNew={isNew}
                            />
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}
