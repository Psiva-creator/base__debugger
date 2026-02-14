"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GraphNode } from "chronovm-graph";
import type { ExplanationEvent } from "chronovm-explain";
import {
    spring,
    nodeAppear,
    highlightPulse,
    addedGlow,
    referenceTargetPulse,
    listContainerPulse,
    listElementAppear,
    listBounce,
} from "@/lib/motion";

interface HeapLayerProps {
    nodes: readonly GraphNode[];
    addedIds: Set<string>;
    changedIds: Set<string>;
    referenceTargetIds: Set<string>;
    events: readonly ExplanationEvent[];
    /** Node ID to highlight (from variable click-to-focus) */
    focusedNodeId?: string | null;
}

/* ══════════════════════════════════════════
   Color System
   ══════════════════════════════════════════ */

const kindGradients: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
    environment: {
        bg: "bg-[var(--accent-blue)]/5",
        border: "border-[var(--accent-blue)]/30",
        text: "text-[var(--accent-blue)]",
        gradient: "linear-gradient(135deg, rgba(122,162,247,0.08) 0%, rgba(122,162,247,0.02) 100%)",
    },
    primitive: {
        bg: "bg-[var(--accent-green)]/5",
        border: "border-[var(--accent-green)]/30",
        text: "text-[var(--accent-green)]",
        gradient: "linear-gradient(135deg, rgba(158,206,106,0.1) 0%, rgba(158,206,106,0.02) 100%)",
    },
    object: {
        bg: "bg-[var(--accent-purple)]/5",
        border: "border-[var(--accent-purple)]/30",
        text: "text-[var(--accent-purple)]",
        gradient: "linear-gradient(135deg, rgba(187,154,247,0.1) 0%, rgba(187,154,247,0.02) 100%)",
    },
    function: {
        bg: "bg-[var(--accent-yellow)]/5",
        border: "border-[var(--accent-yellow)]/30",
        text: "text-[var(--accent-yellow)]",
        gradient: "linear-gradient(135deg, rgba(224,175,104,0.1) 0%, rgba(224,175,104,0.02) 100%)",
    },
    list: {
        bg: "bg-[var(--accent-cyan)]/5",
        border: "border-[var(--accent-cyan)]/30",
        text: "text-[var(--accent-cyan)]",
        gradient: "linear-gradient(135deg, rgba(115,218,202,0.1) 0%, rgba(115,218,202,0.02) 100%)",
    },
};

const defaultStyle = kindGradients.primitive!;

/* ══════════════════════════════════════════
   ListNodeCard — Cinematic list visualization
   ══════════════════════════════════════════ */

const ListNodeCard = React.memo(function ListNodeCard({
    node,
    isNew,
    isChanged,
    isAppended,
    isRefTarget,
    elementCount,
}: {
    node: GraphNode;
    isNew: boolean;
    isChanged: boolean;
    isAppended: boolean;
    isRefTarget: boolean;
    elementCount: number;
}) {
    const style = kindGradients.list!;

    return (
        <motion.div
            layout
            layoutId={node.id}
            key={node.id}
            initial={nodeAppear.initial}
            animate={{
                ...nodeAppear.animate,
                ...(isAppended ? { scale: listContainerPulse.scale, boxShadow: listContainerPulse.boxShadow } : {}),
                ...(isChanged && !isAppended ? { boxShadow: highlightPulse.boxShadow } : {}),
                ...(isRefTarget ? referenceTargetPulse : {}),
            }}
            exit={nodeAppear.exit}
            transition={{
                layout: spring,
                ...(isAppended
                    ? { scale: { duration: 0.25 }, boxShadow: { duration: 0.45 } }
                    : isChanged
                        ? { boxShadow: { duration: 0.6, repeat: 1, repeatType: "reverse" as const } }
                        : {}),
            }}
            className={`
                relative rounded-xl border px-4 py-3 min-w-[130px]
                ${style.bg} ${style.border}
                backdrop-blur-sm
                ${isNew ? "ring-2 ring-[var(--accent-green)]/50" : ""}
            `}
            style={{
                background: style.gradient,
                boxShadow: isNew ? undefined : "0 4px 16px rgba(0,0,0,0.15)",
            }}
        >
            {/* Kind badge */}
            <div className={`text-[10px] font-semibold uppercase tracking-wider ${style.text} mb-2 flex items-center gap-1.5`}>
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-cyan)]/60" />
                List
            </div>

            {/* List cells */}
            <div className="flex flex-wrap gap-1.5 mb-2">
                {Array.from({ length: elementCount }, (_, i) => {
                    const isLastAndNew = isAppended && i === elementCount - 1;
                    return (
                        <motion.div
                            key={`${node.id}-cell-${i}`}
                            {...(isLastAndNew ? {
                                initial: listElementAppear.initial,
                                animate: listElementAppear.animate,
                                transition: listBounce,
                            } : {})}
                            className={`
                                relative flex flex-col items-center
                            `}
                        >
                            {/* Index label */}
                            <span className="text-[8px] text-[var(--text-secondary)]/60 mb-0.5 font-mono">
                                {i}
                            </span>
                            {/* Cell */}
                            <div
                                className={`
                                    w-8 h-8 rounded-lg flex items-center justify-center
                                    text-[10px] font-mono font-medium
                                    border border-[var(--accent-cyan)]/20
                                    hover:border-[var(--accent-cyan)]/50 transition-colors
                                    ${isLastAndNew
                                        ? "bg-[var(--accent-cyan)]/20 text-[var(--accent-cyan)] shadow-md shadow-[var(--accent-cyan)]/10"
                                        : "bg-[var(--surface-raised)]/80 text-[var(--text-primary)]"
                                    }
                                `}
                                style={{
                                    boxShadow: isLastAndNew
                                        ? "0 2px 8px rgba(115,218,202,0.2)"
                                        : "0 1px 4px rgba(0,0,0,0.1)",
                                }}
                            >
                                ●
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Label + address */}
            <div className="text-sm font-mono text-[var(--text-primary)] truncate">
                {node.label}
            </div>
            <div className="text-[9px] text-[var(--text-secondary)] mt-0.5 font-mono opacity-40">
                {node.id}
            </div>
        </motion.div>
    );
});

/* ══════════════════════════════════════════
   HeapNodeCard — Generic heap node (non-list)
   ══════════════════════════════════════════ */

const HeapNodeCard = React.memo(function HeapNodeCard({
    node,
    isNew,
    isChanged,
    isRefTarget,
}: {
    node: GraphNode;
    isNew: boolean;
    isChanged: boolean;
    isRefTarget: boolean;
}) {
    const style = kindGradients[node.kind] ?? defaultStyle;
    const isEnv = node.kind === "environment";

    return (
        <motion.div
            layout
            layoutId={node.id}
            key={node.id}
            initial={nodeAppear.initial}
            animate={{
                ...nodeAppear.animate,
                ...(isNew ? { boxShadow: addedGlow.boxShadow } : {}),
                ...(isChanged ? { boxShadow: highlightPulse.boxShadow } : {}),
                ...(isRefTarget ? referenceTargetPulse : {}),
            }}
            exit={nodeAppear.exit}
            transition={{
                layout: spring,
                ...(isChanged || isNew
                    ? { boxShadow: { duration: 0.6, repeat: 1, repeatType: "reverse" as const } }
                    : {}),
            }}
            className={`
                relative rounded-xl border px-3 py-2.5 min-w-[110px]
                ${style.bg} ${style.border}
                backdrop-blur-sm
                ${isNew ? "ring-2 ring-[var(--accent-green)]/50" : ""}
            `}
            style={{
                background: style.gradient,
                boxShadow: isNew ? undefined : "0 4px 16px rgba(0,0,0,0.15)",
            }}
        >
            {/* Kind badge */}
            <div className={`text-[10px] font-semibold uppercase tracking-wider ${style.text} mb-1 flex items-center gap-1.5`}>
                <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: `var(${isEnv ? "--accent-blue" : style.text.includes("green") ? "--accent-green" : style.text.includes("purple") ? "--accent-purple" : style.text.includes("yellow") ? "--accent-yellow" : "--accent-cyan"})`, opacity: 0.6 }}
                />
                {isEnv ? "Scope" : node.kind}
            </div>

            {/* Label */}
            <div className="text-sm font-mono text-[var(--text-primary)] truncate">
                {node.label}
            </div>

            {/* Address */}
            <div className="text-[9px] text-[var(--text-secondary)] mt-0.5 font-mono opacity-40">
                {node.id}
            </div>
        </motion.div>
    );
});

/* ══════════════════════════════════════════
   HeapLayer — Grid of heap node cards
   ══════════════════════════════════════════ */

export function HeapLayer({ nodes, addedIds, changedIds, referenceTargetIds, events, focusedNodeId }: HeapLayerProps) {
    // Detect which list nodes had elements appended this step
    const appendedListIds = useMemo(() => {
        const ids = new Set<string>();
        for (const evt of events) {
            if (evt.type === "ListAppended") {
                ids.add((evt as any).list);
            }
        }
        return ids;
    }, [events]);

    // Count elements per list node from the label or events
    const listElementCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const node of nodes) {
            if (node.kind === "list") {
                const appendEvents = events.filter(
                    (e) => e.type === "ListAppended" && (e as any).list === node.id
                );
                counts.set(node.id, Math.max(1, appendEvents.length));
            }
        }
        return counts;
    }, [nodes, events]);

    if (nodes.length === 0) return null;

    // Filter out environment/scope and primitive nodes
    const visibleNodes = nodes.filter((n) => n.kind !== "environment" && n.kind !== "primitive");

    if (visibleNodes.length === 0) return null;

    return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            <AnimatePresence mode="popLayout">
                {visibleNodes.map((node) =>
                    node.kind === "list" ? (
                        <ListNodeCard
                            key={node.id}
                            node={node}
                            isNew={addedIds.has(node.id)}
                            isChanged={changedIds.has(node.id)}
                            isAppended={appendedListIds.has(node.id)}
                            isRefTarget={referenceTargetIds.has(node.id)}
                            elementCount={listElementCounts.get(node.id) ?? 0}
                        />
                    ) : (
                        <HeapNodeCard
                            key={node.id}
                            node={node}
                            isNew={addedIds.has(node.id)}
                            isChanged={changedIds.has(node.id)}
                            isRefTarget={referenceTargetIds.has(node.id)}
                        />
                    )
                )}
            </AnimatePresence>
        </div>
    );
}
