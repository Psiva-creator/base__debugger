"use client";

import { motion } from "framer-motion";
import { usePanelMode, type PanelId, type ViewMode } from "@/contexts/ModeContext";

const modes: { key: ViewMode; label: string }[] = [
    { key: "learning", label: "Learn" },
    { key: "pro", label: "Pro" },
];

interface PanelModeToggleProps {
    panelId: PanelId;
}

/**
 * PanelModeToggle — Compact per-panel segmented toggle.
 *
 * Placed in each panel adapter's header. Switches only the
 * given panel's mode — no effect on siblings.
 */
export function PanelModeToggle({ panelId }: PanelModeToggleProps) {
    const { mode, setMode } = usePanelMode(panelId);

    return (
        <div className="relative flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-px gap-0">
            {modes.map((m) => {
                const isActive = mode === m.key;
                return (
                    <button
                        key={m.key}
                        onClick={() => setMode(m.key)}
                        className={`
                            relative z-10 flex items-center px-2 py-0.5 rounded-[5px] text-[10px] font-semibold
                            transition-colors duration-150 cursor-pointer select-none
                            ${isActive
                                ? "text-[var(--background)]"
                                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            }
                        `}
                    >
                        {isActive && (
                            <motion.div
                                layoutId={`panel-toggle-${panelId}`}
                                className="absolute inset-0 rounded-[5px]"
                                style={{
                                    background:
                                        "linear-gradient(135deg, var(--accent-blue), var(--accent-purple))",
                                }}
                                transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 30,
                                    mass: 0.4,
                                }}
                            />
                        )}
                        <span className="relative z-10">{m.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
