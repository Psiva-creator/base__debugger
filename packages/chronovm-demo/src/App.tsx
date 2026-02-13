import { useState, useMemo } from 'react';
import { createInitialState, step } from 'chronovm-core';
import type { IRInstruction, VMState } from 'chronovm-core';
import { analyzeStep } from 'chronovm-analyze';
import type { StepAnalysis } from 'chronovm-analyze';
import type { GraphNode, GraphEdge } from 'chronovm-graph';
import { narrateStep } from 'chronovm-narrate';
import { SourceEditor } from './SourceEditor';
import { compile } from './compiler';
import './App.css';

/* ── Helpers ── */

function buildTrace(program: IRInstruction[]): VMState[] {
    const trace: VMState[] = [];
    let state = createInitialState(program);
    trace.push(state);
    while (state.isRunning) {
        state = step(state);
        trace.push(state);
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

/* ── Default Source ── */

const DEFAULT_SOURCE = `x = 2
obj = {}
obj.a = x`;

/* ── App ── */

export function App() {
    const [sourceCode, setSourceCode] = useState(DEFAULT_SOURCE);
    const [ir, setIr] = useState<IRInstruction[]>(() => compile(DEFAULT_SOURCE));
    const [stepIndex, setStepIndex] = useState(0);
    const [compileError, setCompileError] = useState<string | null>(null);

    const trace = useMemo(() => buildTrace(ir), [ir]);
    const analysis: StepAnalysis = useMemo(() => analyzeStep(trace, stepIndex), [trace, stepIndex]);
    const sentences = useMemo(() => narrateStep(analysis), [analysis]);

    function handleRun() {
        try {
            const compiled = compile(sourceCode);
            setIr(compiled);
            setStepIndex(0);
            setCompileError(null);
        } catch (err: unknown) {
            setCompileError(err instanceof Error ? err.message : String(err));
        }
    }

    return (
        <div className="app">
            <header className="header">
                <h1>ChronoVM Demo</h1>
            </header>

            <div className="two-column-layout">
                <div className="panel editor-panel">
                    <div className="editor-toolbar">
                        <h2>Source Code</h2>
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
                        <div className="controls">
                            <label>
                                Step {stepIndex} / {trace.length - 1}
                                <input
                                    type="range"
                                    min={0}
                                    max={trace.length - 1}
                                    value={stepIndex}
                                    onChange={(e) => setStepIndex(Number(e.target.value))}
                                />
                            </label>
                        </div>
                    </div>

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

            <div className="panel memory-panel">
                <h2>Memory</h2>
                <MemoryView analysis={analysis} />
            </div>
        </div>
    );
}
