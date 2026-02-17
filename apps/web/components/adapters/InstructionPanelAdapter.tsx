"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { VMState, IRInstruction } from "chronovm-core";
import { usePanelMode } from "@/contexts/ModeContext";
import { PanelModeToggle } from "../PanelModeToggle";
import { InstructionView } from "../pro/InstructionView";

interface InstructionPanelAdapterProps {
    rawState: VMState;
    microStepIdx: number;
    totalMicroSteps: number;
    /** Current source line from semantic step */
    sourceLine?: number;
}

const crossfade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
};

/**
 * InstructionPanelAdapter — Mode-switchable instruction display.
 *
 * Learning: Source line indicator (minimal)
 * Pro:      InstructionView (opcode, operands, PC, μ-step)
 */
export function InstructionPanelAdapter({
    rawState,
    microStepIdx,
    totalMicroSteps,
    sourceLine,
}: InstructionPanelAdapterProps) {
    const { mode } = usePanelMode("instructions");

    const currentInstr =
        rawState.pc >= 0 && rawState.pc < rawState.program.length
            ? rawState.program[rawState.pc]
            : null;

    return (
        <div>
            <div className="flex items-center justify-between mb-2 px-4 pt-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-blue)]/70 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-blue)]/60" />
                    Instructions
                </h3>
                <PanelModeToggle panelId="instructions" />
            </div>

            <div className="px-4 pb-3">
                <AnimatePresence mode="wait">
                    {mode === "learning" ? (
                        <motion.div key="instr-learning" {...crossfade}>
                            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                <span className="text-[var(--accent-blue)] font-semibold">
                                    Line {sourceLine ?? "—"}
                                </span>
                                <span className="opacity-50">•</span>
                                <span className="opacity-60">
                                    Step {microStepIdx + 1} / {totalMicroSteps}
                                </span>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="instr-pro" {...crossfade}>
                            <InstructionView
                                instruction={currentInstr ?? null}
                                pc={rawState.pc}
                                microStep={microStepIdx}
                                totalMicroSteps={totalMicroSteps}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
