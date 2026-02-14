"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { StepAnalysis } from "chronovm-analyze";
import type { VMState } from "chronovm-core";
import { nodeAppear, highlightPulse, addedGlow, spring } from "@/lib/motion";

interface FullMemoryGraphProps {
    analysis: StepAnalysis;
    rawState: VMState;
}

/**
 * FullMemoryGraph — Complete heap visualization for Pro mode.
 *
 * Shows ALL heap nodes with their addresses, types, values, and edges.
 * Nothing is filtered or simplified.
 */
export function FullMemoryGraph({ analysis, rawState }: FullMemoryGraphProps) {
    const { graph, diffFromPrevious } = analysis;

    const addedSet = useMemo(
        () => new Set(diffFromPrevious?.addedHeapNodes ?? []),
        [diffFromPrevious]
    );
    const changedSet = useMemo(
        () =>
            new Set([
                ...(diffFromPrevious?.changedHeapNodes ?? []),
                ...(diffFromPrevious?.addedBindings?.map((b) => b.env) ?? []),
                ...(diffFromPrevious?.changedBindings?.map((b) => b.env) ?? []),
            ]),
        [diffFromPrevious]
    );

    // Group nodes by kind
    const nodesByKind = useMemo(() => {
        const groups: Record<string, typeof graph.nodes[number][]> = {};
        for (const node of graph.nodes) {
            const kind = node.kind;
            if (!groups[kind]) groups[kind] = [];
            groups[kind]!.push(node);
        }
        return groups;
    }, [graph.nodes]);

    // Env bindings from current state
    const envBindings = useMemo(() => {
        const result: { envId: string; name: string; addr: string }[] = [];
        for (const [envId, envRec] of Object.entries(rawState.environmentRecords)) {
            if (!envRec) continue;
            for (const [name, addr] of Object.entries(envRec.bindings)) {
                result.push({ envId, name, addr: String(addr) });
            }
        }
        return result;
    }, [rawState.environmentRecords]);

    const kindColors: Record<string, { bg: string; border: string; text: string }> = {
        primitive: { bg: "rgba(122,162,247,0.06)", border: "rgba(122,162,247,0.2)", text: "var(--accent-blue)" },
        list: { bg: "rgba(115,218,202,0.06)", border: "rgba(115,218,202,0.2)", text: "var(--accent-cyan)" },
        object: { bg: "rgba(224,175,104,0.06)", border: "rgba(224,175,104,0.2)", text: "var(--accent-yellow)" },
        function: { bg: "rgba(187,154,247,0.06)", border: "rgba(187,154,247,0.2)", text: "var(--accent-purple)" },
        environment: { bg: "rgba(158,206,106,0.06)", border: "rgba(158,206,106,0.2)", text: "var(--accent-green)" },
    };

    const defaultColor = kindColors.primitive!;

    return (
        <div>
            {/* Environment Bindings Table */}
            <div className="mb-4">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-green)]/70 mb-2 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-green)]/60" />
                    Bindings (env_{rawState.currentEnvironment})
                </h4>
                <div className="rounded-lg border border-[var(--accent-green)]/15 overflow-hidden">
                    <table className="w-full text-xs font-mono">
                        <thead>
                            <tr className="bg-[var(--surface-raised)] text-[10px] text-[var(--text-secondary)]">
                                <th className="px-3 py-1 text-left font-semibold">Name</th>
                                <th className="px-3 py-1 text-left font-semibold">Address</th>
                                <th className="px-3 py-1 text-left font-semibold">Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {envBindings
                                .filter((b) => b.envId === String(rawState.currentEnvironment))
                                .map((b) => {
                                    const heapVal = rawState.heap[b.addr];
                                    return (
                                        <tr
                                            key={`${b.envId}-${b.name}`}
                                            className="border-t border-[var(--border)]/50 hover:bg-[var(--surface-raised)]/50 transition-colors"
                                        >
                                            <td className="px-3 py-1 text-[var(--text-primary)]">{b.name}</td>
                                            <td className="px-3 py-1 text-[var(--text-secondary)]">@{b.addr}</td>
                                            <td className="px-3 py-1 text-[var(--accent-blue)]">{String(heapVal)}</td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* All Heap Nodes by Kind */}
            {Object.entries(nodesByKind).map(([kind, nodes]) => {
                const colors = kindColors[kind] ?? defaultColor;
                return (
                    <div key={kind} className="mb-4">
                        <h4
                            className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                            style={{ color: colors.text }}
                        >
                            <span
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ backgroundColor: colors.text, opacity: 0.6 }}
                            />
                            {kind} ({nodes.length})
                        </h4>

                        <div className="grid grid-cols-2 gap-2">
                            <AnimatePresence mode="popLayout">
                                {nodes.map((node) => {
                                    const isNew = addedSet.has(node.id);
                                    const isChanged = changedSet.has(node.id);

                                    return (
                                        <motion.div
                                            layout
                                            layoutId={`pro-${node.id}`}
                                            key={node.id}
                                            initial={nodeAppear.initial}
                                            animate={{
                                                ...nodeAppear.animate,
                                                ...(isNew ? { boxShadow: addedGlow.boxShadow } : {}),
                                                ...(isChanged ? { boxShadow: highlightPulse.boxShadow } : {}),
                                            }}
                                            exit={nodeAppear.exit}
                                            transition={{
                                                layout: spring,
                                                ...(isChanged || isNew
                                                    ? { boxShadow: { duration: 0.6, repeat: 1, repeatType: "reverse" as const } }
                                                    : {}),
                                            }}
                                            className={`
                                                rounded-lg border px-3 py-2 backdrop-blur-sm
                                                ${isNew ? "ring-1 ring-[var(--accent-green)]/40" : ""}
                                            `}
                                            style={{
                                                background: colors.bg,
                                                borderColor: isNew
                                                    ? "rgba(158,206,106,0.3)"
                                                    : isChanged
                                                        ? colors.border
                                                        : `${colors.border}`,
                                            }}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-mono font-semibold text-[var(--text-primary)] truncate">
                                                    {node.label}
                                                </span>
                                                <span className="text-[8px] font-mono text-[var(--text-secondary)] opacity-50 flex-shrink-0">
                                                    {node.id}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span
                                                    className="text-[8px] font-bold uppercase tracking-wider"
                                                    style={{ color: colors.text }}
                                                >
                                                    {kind}
                                                </span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </div>
                );
            })}

            {/* Edges */}
            {graph.edges.length > 0 && (
                <div className="mb-4">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]/70 mb-2">
                        Edges ({graph.edges.length})
                    </h4>
                    <div className="flex flex-wrap gap-1">
                        {graph.edges.map((edge, i) => (
                            <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border)] text-[9px] font-mono text-[var(--text-secondary)]"
                            >
                                {edge.from} →<span className="text-[var(--accent-blue)]">{edge.label}</span>→ {edge.to}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
