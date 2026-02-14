/**
 * animation-plan.ts — Deterministic animation orchestration layer.
 *
 * Pure function: given a SemanticStep diff, produces a plan of
 * animation intents that the UI layer can execute.
 *
 * Key principle: animations are a PURE FUNCTION of the step diff.
 * No side effects, no state, no timers.
 */

import type { SemanticStep, SemanticType, VariableChange } from "chronovm-analyze";

/* ══════════════════════════════════════════
   Intent Schema
   ══════════════════════════════════════════ */

export type AnimationIntent =
    | { type: "variable_appear"; name: string; value: string }
    | { type: "variable_change"; name: string; from: string; to: string }
    | { type: "output_emit"; line: string }
    | { type: "branch_decision"; label: string; result: boolean }
    | { type: "loop_iteration"; iteration: number; label: string }
    | { type: "loop_exit"; iteration: number; label: string }
    | { type: "list_create"; name?: string }
    | { type: "list_append"; name?: string }
    | { type: "function_call"; name?: string }
    | { type: "function_return" }
    | { type: "halt" }
    | { type: "noop" };

export type AnimationPlan = {
    /** All intents for this step, in execution order */
    readonly intents: readonly AnimationIntent[];
    /** The semantic type that drove the plan */
    readonly semanticType: SemanticType;
    /** Base duration in ms (before speed scaling) */
    readonly baseDurationMs: number;
    /** Focus target(s) — node IDs that should receive visual emphasis */
    readonly focusTargets: readonly string[];
    /** Whether this step should auto-advance (no pause needed) */
    readonly autoAdvance: boolean;
};

/* ══════════════════════════════════════════
   Duration Budget
   ══════════════════════════════════════════ */

const DURATION_MAP: Partial<Record<SemanticType, number>> = {
    branch_decision: 400,
    loop_check: 350,
    loop_iteration: 350,
    loop_exit: 400,
    function_def: 400,
    function_call: 600,
    function_return: 400,
    list_create: 500,
    list_mutate: 500,
    object_create: 500,
    property_access: 400,
    class_def: 400,
    expression: 300,
    halt: 600,
};

const DEFAULT_DURATION = 500;

/* ══════════════════════════════════════════
   Plan Builder — Pure function
   ══════════════════════════════════════════ */

/**
 * Build an animation plan from a semantic step.
 *
 * This is a pure function: same input → same output, always.
 */
export function buildAnimationPlan(step: SemanticStep): AnimationPlan {
    const intents: AnimationIntent[] = [];
    const focusTargets: string[] = [];

    // 1. Variable changes → appear/change intents
    for (const [name, change] of step.variableChanges) {
        if (name.startsWith("__")) continue;
        if (change.before === null) {
            intents.push({ type: "variable_appear", name, value: change.after });
        } else {
            intents.push({
                type: "variable_change",
                name,
                from: change.before,
                to: change.after,
            });
        }
    }

    // 2. Control flow → branch/loop intents
    if (step.controlFlow) {
        if (step.controlFlow.type === "branch") {
            intents.push({
                type: "branch_decision",
                label: step.controlFlow.label,
                result: step.controlFlow.conditionResult,
            });
        } else if (step.controlFlow.type === "loop_check") {
            if (step.controlFlow.conditionResult) {
                intents.push({
                    type: "loop_iteration",
                    iteration: step.iterationNumber ?? 1,
                    label: step.controlFlow.label,
                });
            } else {
                intents.push({
                    type: "loop_exit",
                    iteration: step.iterationNumber ?? 0,
                    label: step.controlFlow.label,
                });
            }
        }
    }

    // 3. Output → print intent
    for (const line of step.outputEmitted) {
        intents.push({ type: "output_emit", line });
    }

    // 4. Semantic type → specific intents
    switch (step.semanticType) {
        case "list_create":
            intents.push({ type: "list_create" });
            break;
        case "list_mutate":
            intents.push({ type: "list_append" });
            break;
        case "function_call":
            intents.push({ type: "function_call" });
            break;
        case "function_return":
            intents.push({ type: "function_return" });
            break;
        case "halt":
            intents.push({ type: "halt" });
            break;
    }

    // 5. Fallback: if no intents, add noop
    if (intents.length === 0) {
        intents.push({ type: "noop" });
    }

    const baseDurationMs = DURATION_MAP[step.semanticType] ?? DEFAULT_DURATION;

    // Auto-advance for simple steps with no visual interest
    const autoAdvance =
        step.semanticType === "expression" &&
        step.variableChanges.size === 0 &&
        step.outputEmitted.length === 0;

    return {
        intents,
        semanticType: step.semanticType,
        baseDurationMs,
        focusTargets,
        autoAdvance,
    };
}
