"use client";

import type { IRInstruction } from "chronovm-core";

interface InstructionViewProps {
    instruction: IRInstruction | null;
    pc: number;
    microStep: number;
    totalMicroSteps: number;
}

/**
 * InstructionView — Shows the current IR instruction being executed.
 *
 * Displays opcode, operands, and PC in a compact card.
 */
export function InstructionView({ instruction, pc, microStep, totalMicroSteps }: InstructionViewProps) {
    return (
        <div className="flex-1 min-w-0">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-blue)]/70 mb-2 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-blue)]/60" />
                Instruction
                <span className="ml-auto text-[var(--text-secondary)] font-normal normal-case tracking-normal">
                    μ-step {microStep + 1}/{totalMicroSteps}
                </span>
            </h4>

            {instruction ? (
                <div
                    className="rounded-lg border px-3 py-2 font-mono text-xs"
                    style={{
                        background: "linear-gradient(135deg, rgba(122,162,247,0.06) 0%, rgba(122,162,247,0.01) 100%)",
                        borderColor: "rgba(122,162,247,0.15)",
                    }}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-[var(--accent-blue)] font-bold">
                            {instruction.opcode}
                        </span>
                        <span className="text-[var(--text-secondary)] text-[10px]">
                            PC {pc}
                        </span>
                    </div>

                    {/* Operands */}
                    <div className="mt-1 text-[10px] text-[var(--text-secondary)]">
                        {Object.entries(instruction)
                            .filter(([k]) => k !== "opcode")
                            .map(([key, val]) => (
                                <span key={key} className="mr-3">
                                    <span className="text-[var(--accent-purple)]">{key}</span>
                                    <span className="text-[var(--text-secondary)]">: </span>
                                    <span className="text-[var(--text-primary)]">{String(val)}</span>
                                </span>
                            ))}
                    </div>
                </div>
            ) : (
                <div className="text-[10px] text-[var(--text-secondary)] italic">
                    No instruction (halted)
                </div>
            )}
        </div>
    );
}
