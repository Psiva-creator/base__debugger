"use client";

import { useState, useMemo, useEffect } from "react";
import { createInitialState, step } from "chronovm-core";
import type { IRInstruction, VMState } from "chronovm-core";
import { analyzeStep, compressTrace } from "chronovm-analyze";
import type { StepAnalysis, SemanticStep } from "chronovm-analyze";
import type { LoopTrackerState, LoopIteration } from "./execution/LoopTracker";
import { narrateStep } from "chronovm-narrate";
import { compileWithSourceMap } from "@/lib/compiler";
import type { CompileResult } from "@/lib/compiler";
import { PYTHON_LESSONS } from "@/lib/lessons";
import { SourceEditor } from "./SourceEditor";
import { ExecutionLayout } from "./execution/ExecutionView";
import { PanelModeProvider } from "@/contexts/ModeContext";
import { ModeToggle } from "./ModeToggle";
import { useAnimationPlan } from "@/hooks/useAnimationPlan";

/* ── Helpers ── */

function buildTrace(program: IRInstruction[]): VMState[] {
    const trace: VMState[] = [];
    let state = createInitialState(program);
    trace.push(state);
    let safety = 0;
    while (state.isRunning && safety < 5000) {
        state = step(state);
        trace.push(state);
        safety++;
    }
    return trace;
}

/* ── Main App ── */

export function ChronoApp() {
    const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
    const currentLesson = PYTHON_LESSONS[currentLessonIdx]!;

    const [sourceCode, setSourceCode] = useState(currentLesson.code);
    const [compileResult, setCompileResult] = useState<CompileResult>(() => {
        try {
            return compileWithSourceMap(currentLesson.code);
        } catch {
            return { instructions: [{ opcode: "HALT" as const }], sourceMap: [0] };
        }
    });
    const [stepIndex, setStepIndex] = useState(0);
    const [compileError, setCompileError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(600);

    function handleLessonChange(idx: number) {
        const lesson = PYTHON_LESSONS[idx]!;
        setCurrentLessonIdx(idx);
        setSourceCode(lesson.code);
        setIsPlaying(false);
        try {
            const compiled = compileWithSourceMap(lesson.code);
            setCompileResult(compiled);
            setStepIndex(0);
            setCompileError(null);
        } catch (err: unknown) {
            setCompileError(err instanceof Error ? err.message : String(err));
        }
    }

    const trace = useMemo(() => {
        try {
            return buildTrace(compileResult.instructions);
        } catch {
            return [createInitialState(compileResult.instructions)];
        }
    }, [compileResult]);

    // Compress the raw trace into semantic steps
    const semanticSteps: SemanticStep[] = useMemo(
        () => compressTrace(trace, compileResult.sourceMap),
        [trace, compileResult.sourceMap]
    );

    const maxStep = semanticSteps.length - 1;
    const currentSemanticStep = semanticSteps[stepIndex] ?? semanticSteps[0];

    // Use the last micro-step of the semantic range for analysis
    const rawIdx = currentSemanticStep
        ? Math.min(currentSemanticStep.microStepRange[1] - 1, trace.length - 1)
        : 0;

    const analysis: StepAnalysis = useMemo(
        () => analyzeStep(trace, rawIdx),
        [trace, rawIdx]
    );
    const sentences = useMemo(() => narrateStep(analysis), [analysis]);
    const currentOutput = trace[rawIdx]?.output ?? [];

    // ── Animation Orchestration ──
    const { plan, scaledDurationMs, isAnimating, intentClass } = useAnimationPlan({
        step: currentSemanticStep ?? null,
        speedMs: speed,
        isPlaying,
        onAnimationComplete: () => {
            // Advance to next step when animation completes
            if (isPlaying && stepIndex < maxStep) {
                setStepIndex((prev) => prev + 1);
            } else if (stepIndex >= maxStep) {
                setIsPlaying(false);
            }
        },
    });

    // Legacy autoplay fallback (when animation plan is not available)
    useEffect(() => {
        if (!isPlaying) return;
        if (plan) return; // Animation plan handles advancement
        if (stepIndex >= maxStep) {
            setIsPlaying(false);
            return;
        }
        const id = setTimeout(() => {
            setStepIndex((prev) => prev + 1);
        }, speed);
        return () => clearTimeout(id);
    }, [isPlaying, stepIndex, speed, maxStep, plan]);

    function handleRun() {
        setIsPlaying(false);
        try {
            const compiled = compileWithSourceMap(sourceCode);
            setCompileResult(compiled);
            setStepIndex(0);
            setCompileError(null);
        } catch (err: unknown) {
            setCompileError(err instanceof Error ? err.message : String(err));
        }
    }

    function handleRestart() {
        setIsPlaying(false);
        setStepIndex(0);
    }
    function handleBack() {
        setIsPlaying(false);
        setStepIndex((i) => Math.max(0, i - 1));
    }
    function handleNext() {
        setIsPlaying(false);
        setStepIndex((i) => Math.min(maxStep, i + 1));
    }
    function handlePlayPause() {
        setIsPlaying((p) => !p);
    }

    // Raw micro-step index for Pro mode
    const microStepIdx = rawIdx;
    const totalMicroSteps = trace.length;
    const rawState = trace[rawIdx]!;

    // ── Variable History + Order (for interactive variable panel) ──
    const { variableHistory, variableOrder } = useMemo(() => {
        const history = new Map<string, { value: string; step: number }[]>();
        const order: string[] = [];

        for (let i = 0; i <= stepIndex && i < semanticSteps.length; i++) {
            const step = semanticSteps[i]!;
            for (const [name, change] of step.variableChanges) {
                if (name.startsWith('__') || name.startsWith('arg')) continue;
                if (!history.has(name)) {
                    history.set(name, []);
                    order.push(name);
                }
                history.get(name)!.push({ value: change.after, step: i });
            }
        }

        return { variableHistory: history as ReadonlyMap<string, readonly { value: string; step: number }[]>, variableOrder: order };
    }, [semanticSteps, stepIndex]);

    // ── Loop State (for LoopTracker) ──
    const loopState = useMemo<LoopTrackerState | null>(() => {
        const current = semanticSteps[stepIndex];
        if (!current) return null;

        // Find the most recent loop context
        let loopLabel = "";
        let loopLine = 0;
        const iterations: LoopIteration[] = [];
        let status: "active" | "exited" = "active";

        // Walk backward to find the loop start, then forward to collect iterations
        for (let i = 0; i <= stepIndex && i < semanticSteps.length; i++) {
            const s = semanticSteps[i]!;
            if (s.controlFlow?.type === "loop_check") {
                if (!loopLabel) {
                    loopLabel = s.controlFlow.label || "while loop";
                    loopLine = s.sourceLine;
                }
                if (!s.controlFlow.conditionResult) {
                    // Loop exited
                    status = "exited";
                }
            }
            if (s.iterationNumber != null && s.iterationNumber > 0) {
                const existing = iterations.find((it) => it.number === s.iterationNumber);
                if (!existing) {
                    // Extract the first variable change as the loop variable
                    let loopVar: { name: string; value: string } | undefined;
                    for (const [name, change] of s.variableChanges) {
                        if (!name.startsWith("__")) {
                            loopVar = { name, value: change.after };
                            break;
                        }
                    }
                    iterations.push({
                        number: s.iterationNumber,
                        loopVar,
                        output: s.outputEmitted,
                    });
                }
            }
        }

        if (iterations.length === 0) return null;

        return {
            sourceLine: loopLine,
            label: loopLabel,
            status,
            iterations,
            currentIteration: iterations[iterations.length - 1]?.number ?? 1,
        };
    }, [semanticSteps, stepIndex]);

    return (
        <PanelModeProvider>
            <div className="flex flex-col h-screen overflow-hidden">
                {/* ── Header ── */}
                <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
                    <h1 className="text-lg font-semibold tracking-tight">
                        <span className="text-2xl mr-2">🐍</span>
                        ChronoVM
                        <span className="text-[var(--text-secondary)] font-normal ml-2 text-sm">
                            Python Debugger
                        </span>
                    </h1>
                    <div className="flex items-center gap-3">
                        <ModeToggle />
                        <select
                            value={currentLessonIdx}
                            onChange={(e) => handleLessonChange(Number(e.target.value))}
                            className="bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[var(--accent-blue)] transition-colors cursor-pointer"
                        >
                            {PYTHON_LESSONS.map((lesson, i) => (
                                <option key={lesson.id} value={i}>
                                    {lesson.title}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={handleRun}
                            className="bg-gradient-to-r from-[var(--accent-green)] to-[var(--accent-cyan)] text-[var(--background)] px-5 py-1.5 rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-[var(--accent-green)]/20 transition-all active:scale-95 cursor-pointer"
                        >
                            ▶ Run
                        </button>
                    </div>
                </header>

                {/* ── Main Content ── */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left: Code Editor */}
                    <div className="w-[40%] min-w-[350px] border-r border-[var(--border)] flex flex-col">
                        {compileError && (
                            <div className="px-4 py-2 bg-[var(--accent-red)]/10 text-[var(--accent-red)] text-sm border-b border-[var(--accent-red)]/20">
                                ⚠ {compileError}
                            </div>
                        )}
                        <div className="flex-1">
                            <SourceEditor value={sourceCode} onChange={setSourceCode} />
                        </div>
                    </div>

                    {/* Right: Execution + Controls */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Playback Controls */}
                        <div className="flex items-center gap-4 px-5 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleRestart}
                                    title="Restart"
                                    className="w-9 h-8 flex items-center justify-center rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)] transition-all text-base cursor-pointer"
                                >
                                    ⏮
                                </button>
                                <button
                                    onClick={handleBack}
                                    disabled={stepIndex === 0}
                                    title="Back"
                                    className="w-9 h-8 flex items-center justify-center rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)] transition-all disabled:opacity-30 disabled:cursor-not-allowed text-base cursor-pointer"
                                >
                                    ⏪
                                </button>
                                <button
                                    onClick={handlePlayPause}
                                    title={isPlaying ? "Pause" : "Auto Play"}
                                    className={`w-11 h-8 flex items-center justify-center rounded-lg font-bold text-base transition-all cursor-pointer ${isPlaying
                                        ? "bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-[var(--background)] shadow-lg shadow-[var(--accent-blue)]/30 animate-pulse"
                                        : "bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] text-[var(--background)] hover:shadow-lg hover:shadow-[var(--accent-blue)]/30"
                                        }`}
                                >
                                    {isPlaying ? "⏸" : "▶"}
                                </button>
                                <button
                                    onClick={handleNext}
                                    disabled={stepIndex >= maxStep}
                                    title="Next"
                                    className="w-9 h-8 flex items-center justify-center rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)] transition-all disabled:opacity-30 disabled:cursor-not-allowed text-base cursor-pointer"
                                >
                                    ⏩
                                </button>
                            </div>

                            <div className="flex-1 flex items-center gap-3">
                                <span className="text-sm text-[var(--text-secondary)] whitespace-nowrap">
                                    Step{" "}
                                    <span className="text-[var(--accent-blue)] font-semibold">
                                        {stepIndex + 1}
                                    </span>{" "}
                                    / {semanticSteps.length}
                                    {currentSemanticStep && (
                                        <span className="text-[var(--accent-purple)] ml-2">
                                            (Line {currentSemanticStep.sourceLine})
                                        </span>
                                    )}
                                </span>
                                <input
                                    type="range"
                                    min={0}
                                    max={maxStep}
                                    value={stepIndex}
                                    onChange={(e) => {
                                        setIsPlaying(false);
                                        setStepIndex(Number(e.target.value));
                                    }}
                                    className="flex-1 h-1.5 rounded-full appearance-none bg-[var(--surface-raised)] cursor-pointer accent-[var(--accent-blue)]"
                                />
                            </div>

                            {/* Speed Selector */}
                            <div className="flex items-center gap-1 pl-3 border-l border-[var(--border)]">
                                {[
                                    { label: "0.5×", ms: 1200 },
                                    { label: "1×", ms: 600 },
                                    { label: "1.5×", ms: 400 },
                                    { label: "2×", ms: 250 },
                                ].map((opt) => (
                                    <button
                                        key={opt.label}
                                        onClick={() => setSpeed(opt.ms)}
                                        className={`px-2 py-0.5 rounded text-xs font-medium transition-all cursor-pointer ${speed === opt.ms
                                            ? "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue)]/40"
                                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Execution Layout — takes remaining space */}
                        <div className="flex-1 overflow-hidden">
                            <ExecutionLayout
                                analysis={analysis}
                                sentences={sentences}
                                output={currentOutput}
                                rawState={rawState}
                                microStepIdx={microStepIdx}
                                totalMicroSteps={totalMicroSteps}
                                variableHistory={variableHistory}
                                variableOrder={variableOrder}
                                currentStep={stepIndex}
                                loopState={loopState}
                                sourceLine={currentSemanticStep?.sourceLine}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </PanelModeProvider>
    );
}
