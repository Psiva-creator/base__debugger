"use client";

import type { StepAnalysis } from "chronovm-analyze";
import type { VMState } from "chronovm-core";
import { FullMemoryGraph } from "./FullMemoryGraph";
import { InstructionView } from "./InstructionView";

interface ProViewProps {
    analysis: StepAnalysis;
    rawState: VMState;
    microStepIdx: number;
    totalMicroSteps: number;
    output: readonly string[];
}

/**
 * ProView — Full-detail execution panel for Pro mode.
 *
 * Shows everything the VM exposes:
 *   ├── InstructionView (current opcode + operands)
 *   ├── FullMemoryGraph (all heap nodes, addresses, edges)
 *   ├── Call Stack
 *   ├── Operand Stack
 *   └── Raw Output
 */
export function ProView({ analysis, rawState, microStepIdx, totalMicroSteps, output }: ProViewProps) {
    const currentInstr = rawState.pc >= 0 && rawState.pc < rawState.program.length
        ? rawState.program[rawState.pc]
        : null;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Top row: Instruction + Stacks */}
            <div className="flex gap-3 p-4 border-b border-[var(--border)]">
                {/* Current Instruction */}
                <InstructionView
                    instruction={currentInstr}
                    pc={rawState.pc}
                    microStep={microStepIdx}
                    totalMicroSteps={totalMicroSteps}
                />

                {/* Operand Stack */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-purple)]/70 mb-2 flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-purple)]/60" />
                        Operand Stack
                    </h4>
                    <div className="flex flex-wrap gap-1">
                        {rawState.operandStack.length === 0 ? (
                            <span className="text-[10px] text-[var(--text-secondary)] italic">empty</span>
                        ) : (
                            [...rawState.operandStack].reverse().map((val, i) => (
                                <span
                                    key={i}
                                    className="px-2 py-0.5 rounded bg-[var(--accent-purple)]/8 border border-[var(--accent-purple)]/15 text-[11px] font-mono text-[var(--text-primary)]"
                                >
                                    {String(val)}
                                </span>
                            ))
                        )}
                    </div>
                </div>

                {/* Call Stack */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-red)]/70 mb-2 flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-red)]/60" />
                        Call Stack
                    </h4>
                    <div className="flex flex-col gap-0.5">
                        {rawState.callStack.length === 0 ? (
                            <span className="text-[10px] text-[var(--text-secondary)] italic">global</span>
                        ) : (
                            [...rawState.callStack].reverse().map((frame, i) => (
                                <span
                                    key={i}
                                    className="px-2 py-0.5 rounded bg-[var(--accent-red)]/8 border border-[var(--accent-red)]/15 text-[10px] font-mono text-[var(--text-primary)]"
                                >
                                    PC:{(frame as any).returnAddress ?? "?"} Env:{(frame as any).environment ?? "?"}
                                </span>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Memory Graph */}
            <div className="flex-1 overflow-auto p-4">
                <FullMemoryGraph analysis={analysis} rawState={rawState} />
            </div>

            {/* Raw Output */}
            {output.length > 0 && (
                <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2 max-h-[20%] overflow-auto">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-green)]/70 mb-1">
                        stdout
                    </h4>
                    <pre className="text-xs font-mono text-[var(--text-primary)] bg-[var(--background)] rounded-lg p-2 leading-relaxed">
                        {output.join("\n")}
                    </pre>
                </div>
            )}
        </div>
    );
}
