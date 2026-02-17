"use client";

import { motion } from "framer-motion";
import { usePanelModes, type ViewMode } from "@/contexts/ModeContext";

const modes: { key: ViewMode; label: string; icon: string }[] = [
    { key: "learning", label: "Learn", icon: "📖" },
    { key: "pro", label: "Pro", icon: "🔧" },
];

/**
 * ModeToggle — Global segmented pill toggle for Learning / Pro mode.
 *
 * Switches ALL panels at once via syncAllPanelsTo.
 * Fixed width, no layout shift. Active segment has accent gradient fill.
 */
export function ModeToggle() {
    const { panelModes, syncAllPanelsTo } = usePanelModes();
    // Derive global mode: "learning" if all panels are learning, else "pro"
    const mode: ViewMode = Object.values(panelModes).every((m) => m === "learning")
        ? "learning"
        : "pro";

    return (
        <div className="relative flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-0.5 gap-0">
            {modes.map((m) => {
                const isActive = mode === m.key;
                return (
                    <button
                        key={m.key}
                        onClick={() => syncAllPanelsTo(m.key)}
                        className={`
                            relative z-10 flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold
                            transition-colors duration-200 cursor-pointer select-none
                            ${isActive
                                ? "text-[var(--background)]"
                                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            }
                        `}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="mode-toggle-active"
                                className="absolute inset-0 rounded-md"
                                style={{
                                    background:
                                        "linear-gradient(135deg, var(--accent-blue), var(--accent-purple))",
                                }}
                                transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 28,
                                    mass: 0.5,
                                }}
                            />
                        )}
                        <span className="relative z-10">{m.icon}</span>
                        <span className="relative z-10">{m.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
