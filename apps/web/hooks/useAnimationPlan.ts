"use client";

/**
 * useAnimationPlan — React hook that maps animation intents to timing + motion props.
 *
 * Consumes a SemanticStep and produces:
 *  - The computed AnimationPlan
 *  - Scaled duration (accounting for playback speed)
 *  - CSS class helpers for glow/dim effects
 *  - An `isAnimating` flag for gating autoplay
 */

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import type { SemanticStep } from "chronovm-analyze";
import { buildAnimationPlan, type AnimationPlan, type AnimationIntent } from "@/lib/animation-plan";

interface UseAnimationPlanOptions {
    /** Current semantic step */
    step: SemanticStep | null;
    /** Playback speed in ms per step (e.g., 600 = 1x) */
    speedMs: number;
    /** Whether playback is running */
    isPlaying: boolean;
    /** Callback when animation completes */
    onAnimationComplete?: () => void;
}

interface AnimationPlanResult {
    /** The computed plan for the current step */
    plan: AnimationPlan | null;
    /** Scaled duration in ms */
    scaledDurationMs: number;
    /** Whether we're currently animating */
    isAnimating: boolean;
    /** CSS class for the dominant intent */
    intentClass: string;
    /** Whether the current step has variable changes */
    hasChanges: boolean;
    /** Whether the current step has output */
    hasOutput: boolean;
}

const BASE_SPEED = 600; // 1x speed reference

/**
 * Compute the speed multiplier: 1.0 at 600ms, 2.0 at 300ms, 0.5 at 1200ms
 */
function speedMultiplier(speedMs: number): number {
    return BASE_SPEED / Math.max(speedMs, 100);
}

/**
 * Map the dominant intent to a CSS class name for styling.
 */
function intentToClass(intents: readonly AnimationIntent[]): string {
    if (intents.length === 0) return "anim-noop";

    // Use the first semantically interesting intent
    for (const intent of intents) {
        switch (intent.type) {
            case "variable_appear":
                return "anim-var-appear";
            case "variable_change":
                return "anim-var-change";
            case "branch_decision":
                return "anim-branch";
            case "loop_iteration":
                return "anim-loop-iter";
            case "loop_exit":
                return "anim-loop-exit";
            case "output_emit":
                return "anim-output";
            case "list_create":
            case "list_append":
                return "anim-list";
            case "function_call":
                return "anim-fn-call";
            case "function_return":
                return "anim-fn-return";
            case "halt":
                return "anim-halt";
        }
    }
    return "anim-noop";
}

export function useAnimationPlan({
    step,
    speedMs,
    isPlaying,
    onAnimationComplete,
}: UseAnimationPlanOptions): AnimationPlanResult {
    const [isAnimating, setIsAnimating] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const plan = useMemo(
        () => (step ? buildAnimationPlan(step) : null),
        [step]
    );

    const multiplier = speedMultiplier(speedMs);
    const scaledDurationMs = plan
        ? Math.round(plan.baseDurationMs / multiplier)
        : 0;

    const intentClass = plan ? intentToClass(plan.intents) : "anim-noop";

    // Start animation timer when step changes during playback
    const onComplete = useCallback(() => {
        setIsAnimating(false);
        onAnimationComplete?.();
    }, [onAnimationComplete]);

    useEffect(() => {
        if (!plan || !isPlaying) {
            setIsAnimating(false);
            return;
        }

        // Auto-advance steps skip animation
        if (plan.autoAdvance) {
            onComplete();
            return;
        }

        setIsAnimating(true);

        timerRef.current = setTimeout(() => {
            onComplete();
        }, scaledDurationMs);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [plan, isPlaying, scaledDurationMs, onComplete]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const hasChanges = plan
        ? plan.intents.some(
            (i) => i.type === "variable_appear" || i.type === "variable_change"
        )
        : false;

    const hasOutput = plan
        ? plan.intents.some((i) => i.type === "output_emit")
        : false;

    return {
        plan,
        scaledDurationMs,
        isAnimating,
        intentClass,
        hasChanges,
        hasOutput,
    };
}
