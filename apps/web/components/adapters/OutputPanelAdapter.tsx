"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePanelMode } from "@/contexts/ModeContext";
import { PanelModeToggle } from "../PanelModeToggle";

interface OutputPanelAdapterProps {
    output: readonly string[];
}

const crossfade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
};

/**
 * OutputPanelAdapter — Mode-switchable output display.
 *
 * Learning: Friendly "📤 Output" panel
 * Pro:      Raw stdout (monospace, minimal decoration)
 */
export function OutputPanelAdapter({ output }: OutputPanelAdapterProps) {
    const { mode } = usePanelMode("output");

    if (output.length === 0) return null;

    return (
        <div className="px-4 py-2 border-b border-[var(--border)]">
            <div className="flex items-center justify-between mb-1">
                <h3
                    className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${mode === "learning"
                            ? "text-[var(--accent-green)]"
                            : "text-[var(--accent-green)]/70"
                        }`}
                >
                    {mode === "learning" ? "📤 Output" : "stdout"}
                </h3>
                <PanelModeToggle panelId="output" />
            </div>

            <AnimatePresence mode="wait">
                {mode === "learning" ? (
                    <motion.div key="output-learning" {...crossfade}>
                        <pre className="text-xs font-mono text-[var(--text-primary)] bg-[var(--background)] rounded-lg p-2 max-h-20 overflow-auto leading-relaxed">
                            {output.join("\n")}
                        </pre>
                    </motion.div>
                ) : (
                    <motion.div key="output-pro" {...crossfade}>
                        <pre className="text-xs font-mono text-[var(--text-primary)] bg-[var(--background)] rounded-lg p-2 max-h-20 overflow-auto leading-relaxed border border-[var(--border)]">
                            {output.join("\n")}
                        </pre>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
