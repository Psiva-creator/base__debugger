import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createInitialState, step } from 'chronovm-core';
import type { IRInstruction, VMState } from 'chronovm-core';
import { analyzeStep } from 'chronovm-analyze';
import type { StepAnalysis } from 'chronovm-analyze';
import type { GraphNode, GraphEdge } from 'chronovm-graph';
import { narrateStep } from 'chronovm-narrate';
import { SourceEditor } from './SourceEditor';
import { compile } from './python-compiler';
import { PYTHON_LESSONS } from './lessons';
import './App.css';

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

/* ── Layout Constants ── */

const ENV_X = 80;
const HEAP_X = 420;
const NODE_W = 140;
const NODE_H = 50;
const Y_SPACING = 80;
const Y_START = 30;

function nodeY(index: number): number {
    return Y_START + index * Y_SPACING;
}

/* ── SubComponents ── */

function MemoryView({ analysis }: { analysis: StepAnalysis }) {
    const envNodes = analysis.graph.nodes.filter((n: GraphNode) => n.kind === 'environment');
    const heapNodes = analysis.graph.nodes.filter((n: GraphNode) => n.kind !== 'environment');

    const posMap = new Map<string, { x: number; y: number }>();
    envNodes.forEach((n: GraphNode, i: number) => posMap.set(n.id, { x: ENV_X, y: nodeY(i) }));
    heapNodes.forEach((n: GraphNode, i: number) => posMap.set(n.id, { x: HEAP_X, y: nodeY(i) }));

    const svgH = Y_START + Math.max(envNodes.length, heapNodes.length, 1) * Y_SPACING + 40;

    return (
        <svg className="memory-svg" width={620} height={svgH}>
            <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#7aa2f7" />
                </marker>
            </defs>

            {analysis.graph.edges.map((e: GraphEdge, i: number) => {
                const from = posMap.get(e.from);
                const to = posMap.get(e.to);
                if (!from || !to) return null;
                const x1 = from.x + NODE_W;
                const y1 = from.y + NODE_H / 2;
                const x2 = to.x;
                const y2 = to.y + NODE_H / 2;
                return (
                    <g key={`edge-${i}`}>
                        <line
                            x1={x1} y1={y1} x2={x2} y2={y2}
                            stroke="#7aa2f7" strokeWidth={1.5}
                            markerEnd="url(#arrowhead)"
                        />
                        <text
                            x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6}
                            className="edge-label"
                        >
                            {e.label}
                        </text>
                    </g>
                );
            })}

            {envNodes.map((n: GraphNode, i: number) => (
                <g key={n.id}>
                    <rect
                        x={ENV_X} y={nodeY(i)}
                        width={NODE_W} height={NODE_H}
                        rx={6} className="node-env"
                    />
                    <text x={ENV_X + NODE_W / 2} y={nodeY(i) + NODE_H / 2 + 5} className="node-text">
                        {n.label}
                    </text>
                </g>
            ))}

            {heapNodes.map((n: GraphNode, i: number) => {
                const cls = n.kind === 'object' ? 'node-obj' : n.kind === 'function' ? 'node-fn' : 'node-prim';
                return (
                    <g key={n.id}>
                        <rect
                            x={HEAP_X} y={nodeY(i)}
                            width={NODE_W} height={NODE_H}
                            rx={6} className={cls}
                        />
                        <text x={HEAP_X + 10} y={nodeY(i) + 16} className="node-kind">
                            {n.kind}
                        </text>
                        <text x={HEAP_X + NODE_W / 2} y={nodeY(i) + NODE_H / 2 + 10} className="node-text">
                            {n.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

function ExplanationView({ analysis }: { analysis: StepAnalysis }) {
    if (analysis.plans.length === 0 && analysis.events.length === 0) {
        return <div className="explanation-empty">No events at this step.</div>;
    }

    return (
        <div className="explanation-panel">
            {analysis.plans.length > 0 && (
                <div className="section">
                    <h3>Explanation Plans</h3>
                    <ul>
                        {analysis.plans.map((p, i) => (
                            <li key={i} className="plan-item">
                                <span className="plan-category">{p.category}</span>
                                <span className="plan-sep"> — </span>
                                <span className="plan-key">{p.key}</span>
                                <span className="plan-sep"> — </span>
                                <code className="plan-data">{JSON.stringify(p.data)}</code>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

/* ── App ── */

export function App() {
    const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
    const currentLesson = PYTHON_LESSONS[currentLessonIdx]!;

    const [sourceCode, setSourceCode] = useState(currentLesson.code);
    const [ir, setIr] = useState<IRInstruction[]>(() => {
        try { return compile(currentLesson.code); }
        catch { return [{ opcode: 'HALT' as const }]; }
    });
    const [stepIndex, setStepIndex] = useState(0);
    const [compileError, setCompileError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    function handleLessonChange(idx: number) {
        const lesson = PYTHON_LESSONS[idx]!;
        setCurrentLessonIdx(idx);
        setSourceCode(lesson.code);
        setIsPlaying(false);
        try {
            const compiled = compile(lesson.code);
            setIr(compiled);
            setStepIndex(0);
            setCompileError(null);
        } catch (err: unknown) {
            setCompileError(err instanceof Error ? err.message : String(err));
        }
    }

    const trace = useMemo(() => {
        try { return buildTrace(ir); }
        catch { return [createInitialState(ir)]; }
    }, [ir]);
    const maxStep = trace.length - 1;
    const analysis: StepAnalysis = useMemo(() => analyzeStep(trace, stepIndex), [trace, stepIndex]);
    const sentences = useMemo(() => narrateStep(analysis), [analysis]);
    const currentOutput = trace[stepIndex]?.output ?? [];

    // ── Autoplay ──
    useEffect(() => {
        if (!isPlaying) return;
        if (stepIndex >= maxStep) {
            setIsPlaying(false);
            return;
        }
        const timer = setInterval(() => {
            setStepIndex(prev => {
                if (prev >= maxStep) {
                    setIsPlaying(false);
                    return prev;
                }
                return prev + 1;
            });
        }, 400);
        return () => clearInterval(timer);
    }, [isPlaying, stepIndex, maxStep]);

    function handleRun() {
        setIsPlaying(false);
        try {
            const compiled = compile(sourceCode);
            setIr(compiled);
            setStepIndex(0);
            setCompileError(null);
        } catch (err: unknown) {
            setCompileError(err instanceof Error ? err.message : String(err));
        }
    }

    function handleRestart() { setIsPlaying(false); setStepIndex(0); }
    function handleBack() { setIsPlaying(false); setStepIndex(i => Math.max(0, i - 1)); }
    function handleNext() { setIsPlaying(false); setStepIndex(i => Math.min(maxStep, i + 1)); }
    function handlePlayPause() { setIsPlaying(p => !p); }

    return (
        <div className="app">
            <header className="header">
                <h1>🐍 ChronoVM — Python Course</h1>
            </header>

            <div className="two-column-layout">
                <div className="panel editor-panel">
                    <div className="editor-toolbar">
                        <div className="course-nav">
                            <select
                                value={currentLessonIdx}
                                onChange={(e) => handleLessonChange(Number(e.target.value))}
                                className="lesson-select"
                            >
                                {PYTHON_LESSONS.map((lesson, i) => (
                                    <option key={lesson.id} value={i}>{lesson.title}</option>
                                ))}
                            </select>
                        </div>
                        <button className="run-btn" onClick={handleRun}>
                            ▶ Run
                        </button>
                    </div>


                    {compileError && (
                        <div className="compile-error">{compileError}</div>
                    )}
                    <div className="editor-wrapper">
                        <SourceEditor
                            value={sourceCode}
                            onChange={(v) => setSourceCode(v)}
                        />
                    </div>
                </div>

                <div className="right-column">
                    <div className="panel controls-panel">
                        <div className="step-label">
                            Step <strong>{stepIndex}</strong> / {maxStep}
                        </div>
                        <input
                            type="range"
                            className="step-slider"
                            min={0}
                            max={maxStep}
                            value={stepIndex}
                            onChange={(e) => { setIsPlaying(false); setStepIndex(Number(e.target.value)); }}
                        />
                        <div className="playback-controls">
                            <button className="playback-btn" onClick={handleRestart} title="Restart">
                                ⏮
                            </button>
                            <button className="playback-btn" onClick={handleBack} title="Back" disabled={stepIndex === 0}>
                                ⏪
                            </button>
                            <button className={`playback-btn play-btn ${isPlaying ? 'playing' : ''}`} onClick={handlePlayPause} title={isPlaying ? 'Pause' : 'Auto Play'}>
                                {isPlaying ? '⏸' : '▶'}
                            </button>
                            <button className="playback-btn" onClick={handleNext} title="Next" disabled={stepIndex >= maxStep}>
                                ⏩
                            </button>
                        </div>
                    </div>

                    {/* Output Panel */}
                    {currentOutput.length > 0 && (
                        <div className="panel output-panel">
                            <h2>📤 Output</h2>
                            <pre className="output-content">
                                {currentOutput.join('\n')}
                            </pre>
                        </div>
                    )}

                    <div className="panel narration-panel">
                        <h2>What Happened</h2>
                        {sentences.length > 0 ? (
                            <div className="narration-section">
                                <ul>
                                    {sentences.map((s, i) => (
                                        <li key={i} className="narration-item">{s}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <div className="explanation-empty">Nothing changed at this step.</div>
                        )}
                        <ExplanationView analysis={analysis} />
                    </div>
                </div>
            </div>
        </div>
    );
}
