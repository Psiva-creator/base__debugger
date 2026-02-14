"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GraphNode, GraphEdge } from "chronovm-graph";
import { nodeAppear, highlightPulse, addedGlow, spring } from "@/lib/motion";

/* ── Types ── */

export interface VariableHistoryEntry {
    value: string;
    step: number;
}

interface VariableCardsProps {
    nodes: readonly GraphNode[];
    edges: readonly GraphEdge[];
    addedIds: Set<string>;
    changedIds: Set<string>;
    /** Per-variable history: name → last N entries */
    variableHistory?: ReadonlyMap<string, readonly VariableHistoryEntry[]>;
    /** Stable display order: variable names in first-appearance order */
    variableOrder?: readonly string[];
    /** Current semantic step index */
    currentStep?: number;
    /** Callback when a variable is clicked (for data structure linking) */
    onFocusVariable?: (nodeId: string) => void;
    /** Currently focused variable node ID (from HeapLayer hover) */
    focusedNodeId?: string | null;
}

/**
 * VariableCards — Interactive glassmorphism variable cards.
 *
 * Features:
 *  - Hover tooltip (previous value + last changed step)
 *  - Click-to-focus (emits nodeId to highlight linked data structure)
 *  - Change history trail (compact inline strip, last 3 values)
 *  - Stable ordering (by first-appearance, never reorders)
 *  - Visual dim/focus hierarchy (changed vs unchanged)
 */
export function VariableCards({
    nodes,
    edges,
    addedIds,
    changedIds,
    variableHistory,
    variableOrder,
    currentStep,
    onFocusVariable,
    focusedNodeId,
}: VariableCardsProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Only show primitive nodes
    const primitives = useMemo(
        () => nodes.filter((n) => n.kind === "primitive"),
        [nodes]
    );

    // Map each primitive address → variable name(s) via env edges
    const varNames = useMemo(() => {
        const map = new Map<string, string>();
        for (const edge of edges) {
            const targetNode = nodes.find((n) => n.id === edge.to);
            if (targetNode?.kind === "primitive") {
                map.set(edge.to, edge.label);
            }
        }
        return map;
    }, [edges, nodes]);

    // Reverse map: variable name → node id
    const nameToNodeId = useMemo(() => {
        const map = new Map<string, string>();
        for (const [nodeId, name] of varNames) {
            map.set(name, nodeId);
        }
        return map;
    }, [varNames]);

    // Stable ordering: use provided order, or fall back to natural order
    const orderedPrimitives = useMemo(() => {
        if (!variableOrder || variableOrder.length === 0) return primitives;

        const byName = new Map<string, typeof primitives[number]>();
        for (const p of primitives) {
            const name = varNames.get(p.id);
            if (name) byName.set(name, p);
        }

        const result: typeof primitives[number][] = [];
        for (const name of variableOrder) {
            const node = byName.get(name);
            if (node) result.push(node);
        }
        // Add any remaining not in variableOrder
        for (const p of primitives) {
            if (!result.includes(p)) result.push(p);
        }
        return result;
    }, [primitives, variableOrder, varNames]);

    // Has any variable changed this step?
    const hasChanges = changedIds.size > 0 || addedIds.size > 0;

    // Hover handlers with 200ms delay
    const handleMouseEnter = useCallback((nodeId: string) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => setHoveredId(nodeId), 200);
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
        setHoveredId(null);
    }, []);

    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        };
    }, []);

    function inferType(value: string): string {
        if (value === "true" || value === "false") return "bool";
        if (value === "null" || value === "None") return "none";
        if (!isNaN(Number(value))) {
            return value.includes(".") ? "float" : "int";
        }
        return "str";
    }

    if (orderedPrimitives.length === 0) return null;

    return (
        <div className="mb-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-blue)]/70 mb-3 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-blue)]/60" />
                Variables
            </h4>

            <div className="flex flex-col gap-2">
                <AnimatePresence mode="popLayout">
                    {orderedPrimitives.map((node) => {
                        const varName = varNames.get(node.id);
                        const isNew = addedIds.has(node.id);
                        const isChanged = changedIds.has(node.id);
                        const typeLabel = inferType(node.label);
                        const isHovered = hoveredId === node.id;
                        const isFocused = focusedNodeId === node.id;
                        const isDimmed = hasChanges && !isNew && !isChanged && !isFocused;

                        // Get history for this variable
                        const history = varName && variableHistory
                            ? variableHistory.get(varName) ?? []
                            : [];
                        const trail = history.slice(-3); // last 3 entries

                        return (
                            <motion.div
                                layout
                                layoutId={`var-card-${node.id}`}
                                key={node.id}
                                initial={nodeAppear.initial}
                                animate={{
                                    ...nodeAppear.animate,
                                    opacity: isDimmed ? 0.6 : 1,
                                    ...(isNew
                                        ? { boxShadow: addedGlow.boxShadow }
                                        : {}),
                                    ...(isChanged
                                        ? { boxShadow: highlightPulse.boxShadow }
                                        : {}),
                                    ...(isFocused
                                        ? { boxShadow: "0 0 0 2px rgba(187,154,247,0.5)" }
                                        : {}),
                                }}
                                exit={nodeAppear.exit}
                                transition={{
                                    layout: spring,
                                    opacity: { duration: 0.15 },
                                    ...(isChanged || isNew
                                        ? {
                                            boxShadow: {
                                                duration: 0.6,
                                                repeat: 1,
                                                repeatType: "reverse" as const,
                                            },
                                        }
                                        : {}),
                                }}
                                className={`
                                    relative flex flex-col gap-1 rounded-xl border px-4 py-2.5
                                    backdrop-blur-sm cursor-pointer select-none
                                    transition-[border-color] duration-200
                                    ${isNew ? "ring-1 ring-[var(--accent-green)]/40" : ""}
                                `}
                                style={{
                                    background:
                                        "linear-gradient(135deg, rgba(122,162,247,0.06) 0%, rgba(122,162,247,0.01) 100%)",
                                    borderColor: isFocused
                                        ? "rgba(187,154,247,0.4)"
                                        : isNew
                                            ? "rgba(158,206,106,0.3)"
                                            : isChanged
                                                ? "rgba(122,162,247,0.3)"
                                                : "rgba(122,162,247,0.12)",
                                    boxShadow:
                                        isNew || isChanged || isFocused
                                            ? undefined
                                            : "0 2px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
                                    minHeight: 44,
                                }}
                                onMouseEnter={() => handleMouseEnter(node.id)}
                                onMouseLeave={handleMouseLeave}
                                onClick={() => onFocusVariable?.(node.id)}
                            >
                                {/* Main row: name → value → type */}
                                <div className="flex items-center gap-3">
                                    {/* Address tag */}
                                    <span className="absolute top-1.5 right-2.5 font-mono text-[8px] text-[var(--text-secondary)] opacity-25">
                                        {node.id}
                                    </span>

                                    {/* Variable name badge */}
                                    {varName && (
                                        <span className="font-mono text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-raised)] px-3 py-1 rounded-md border border-[var(--border)] min-w-[36px] text-center">
                                            {varName}
                                        </span>
                                    )}

                                    {/* Arrow */}
                                    <div className="flex items-center gap-0 flex-shrink-0">
                                        <div
                                            className="h-[1.5px] rounded-full"
                                            style={{
                                                width: 20,
                                                background:
                                                    "linear-gradient(90deg, var(--text-secondary), var(--accent-blue))",
                                            }}
                                        />
                                        <div
                                            style={{
                                                width: 0,
                                                height: 0,
                                                borderTop: "4px solid transparent",
                                                borderBottom: "4px solid transparent",
                                                borderLeft: "5px solid var(--accent-blue)",
                                            }}
                                        />
                                    </div>

                                    {/* Value box */}
                                    <motion.span
                                        key={`val-${node.id}-${node.label}`}
                                        initial={
                                            isNew || isChanged
                                                ? { scale: 0.7, opacity: 0 }
                                                : undefined
                                        }
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 20,
                                            delay: isNew ? 0.15 : 0,
                                        }}
                                        className="font-mono text-xs font-bold text-[var(--text-primary)] bg-[var(--accent-blue)]/8 px-3 py-1 rounded-lg border border-[var(--accent-blue)]/15 min-w-[36px] text-center"
                                    >
                                        {node.label}
                                    </motion.span>

                                    {/* Type tag */}
                                    <span className="ml-auto text-[8px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-50 bg-[var(--surface-raised)] px-1.5 py-0.5 rounded">
                                        {typeLabel}
                                    </span>

                                    {/* Changed badge */}
                                    {(isChanged && !isNew) && (
                                        <motion.span
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-[9px] text-[var(--accent-blue)]"
                                        >
                                            ↻
                                        </motion.span>
                                    )}
                                </div>

                                {/* Change History Trail */}
                                {trail.length > 1 && (
                                    <div className="flex items-center gap-1 mt-0.5 ml-1">
                                        {trail.map((entry, i) => {
                                            const isLast = i === trail.length - 1;
                                            return (
                                                <span key={entry.step} className="flex items-center gap-1">
                                                    {i > 0 && (
                                                        <span className="text-[8px] text-[var(--text-secondary)] opacity-30">→</span>
                                                    )}
                                                    <span
                                                        className={`text-[10px] font-mono ${isLast
                                                            ? "text-[var(--text-primary)] font-semibold bg-[var(--accent-blue)]/8 px-1.5 py-0.5 rounded"
                                                            : "text-[var(--text-secondary)] opacity-50"
                                                            }`}
                                                    >
                                                        {entry.value}
                                                    </span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Hover Tooltip */}
                                <AnimatePresence>
                                    {isHovered && trail.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 4, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 4, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute -top-[72px] left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                                        >
                                            <div
                                                className="rounded-lg border px-3 py-2 text-[10px] font-mono shadow-xl min-w-[140px]"
                                                style={{
                                                    background: "var(--surface-raised)",
                                                    borderColor: "rgba(122,162,247,0.2)",
                                                    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                                                }}
                                            >
                                                <div className="font-semibold text-[var(--text-primary)] mb-1">
                                                    {varName}
                                                </div>
                                                {trail.length >= 2 && (
                                                    <div className="text-[var(--text-secondary)]">
                                                        Previous: <span className="text-[var(--accent-purple)]">{trail[trail.length - 2]!.value}</span>
                                                    </div>
                                                )}
                                                <div className="text-[var(--text-secondary)]">
                                                    {trail.length === 1 ? "Created" : "Changed"} at:{" "}
                                                    <span className="text-[var(--accent-blue)]">
                                                        Step {trail[trail.length - 1]!.step + 1}
                                                    </span>
                                                </div>
                                                <div className="text-[var(--text-secondary)]">
                                                    Type: <span className="text-[var(--accent-green)]">{typeLabel}</span>
                                                </div>
                                            </div>
                                            {/* Tooltip arrow */}
                                            <div
                                                className="mx-auto w-0 h-0"
                                                style={{
                                                    borderLeft: "6px solid transparent",
                                                    borderRight: "6px solid transparent",
                                                    borderTop: "6px solid rgba(122,162,247,0.2)",
                                                }}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}
