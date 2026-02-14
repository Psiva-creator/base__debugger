/**
 * Shared Framer Motion animation configurations.
 * Use consistently across all animated components.
 *
 * ── ELITE ANIMATION ENGINE ──
 * Deterministic, cinematic, snapshot-diff driven.
 */

/* ══════════════════════════════════════════
   Springs
   ══════════════════════════════════════════ */

/** Smooth spring for layout transitions and node movements */
export const spring = {
    type: "spring" as const,
    stiffness: 260,
    damping: 20,
    mass: 0.6,
};

/** Gentler spring for subtle animations */
export const gentleSpring = {
    type: "spring" as const,
    stiffness: 180,
    damping: 24,
    mass: 0.8,
};

/** Quick snap for immediate feedback (shared reference arrows) */
export const snapSpring = {
    type: "spring" as const,
    stiffness: 400,
    damping: 30,
    mass: 0.4,
};

/** Magnetic snap for binding arrows landing on existing objects */
export const magnetSnap = {
    type: "spring" as const,
    stiffness: 500,
    damping: 28,
    mass: 0.3,
};

/* ══════════════════════════════════════════
   Node Appear / Exit
   ══════════════════════════════════════════ */

/** Scale + fade for new nodes appearing (glass-matched) */
export const nodeAppear = {
    initial: { opacity: 0, scale: 0.8, y: 12 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.85, y: -8 },
};

/** Fade-in/out defaults */
export const fadeIn = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
};

/* ══════════════════════════════════════════
   Highlight / Glow
   ══════════════════════════════════════════ */

/** Highlight pulse for changed nodes (blue neon glow) */
export const highlightPulse = {
    boxShadow: [
        "0 0 0 0 rgba(122, 162, 247, 0)",
        "0 0 12px 4px rgba(122, 162, 247, 0.35)",
        "0 0 0 0 rgba(122, 162, 247, 0)",
    ],
};

/** Green glow pulse for newly added nodes */
export const addedGlow = {
    boxShadow: [
        "0 0 0 0 rgba(158, 206, 106, 0)",
        "0 0 12px 4px rgba(158, 206, 106, 0.35)",
        "0 0 0 0 rgba(158, 206, 106, 0)",
    ],
};

/** Subtle pulse for shared reference targets */
export const referenceTargetPulse = {
    scale: [1, 1.02, 1],
    boxShadow: [
        "0 0 0 0 rgba(187, 154, 247, 0)",
        "0 0 8px 3px rgba(187, 154, 247, 0.3)",
        "0 0 0 0 rgba(187, 154, 247, 0)",
    ],
};

/* ══════════════════════════════════════════
   List Animations (Cinematic)
   ══════════════════════════════════════════ */

/** List container pulse when element is appended */
export const listContainerPulse = {
    scale: [1, 1.04, 1],
    boxShadow: [
        "0 0 0 0 rgba(115, 218, 202, 0)",
        "0 0 16px 6px rgba(115, 218, 202, 0.3)",
        "0 0 0 0 rgba(115, 218, 202, 0)",
    ],
};

/** New list element slide-in with bounce */
export const listElementAppear = {
    initial: { opacity: 0, y: -20, scale: 0.7 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 10, scale: 0.8 },
};

/** Spring config for list element bounce (subtle overshoot) */
export const listBounce = {
    type: "spring" as const,
    stiffness: 300,
    damping: 18,
    mass: 0.5,
};

/* ══════════════════════════════════════════
   Arrow / Connection Animations
   ══════════════════════════════════════════ */

/** Arrow draw-in (path length animation) */
export const arrowDraw = {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 0.3, ease: "easeOut" as const },
};

/** Arrow appear for connection indicators */
export const arrowAppear = {
    initial: { opacity: 0, x: -10, scale: 0.9 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 10, scale: 0.9 },
};

/* ══════════════════════════════════════════
   Environment / CallStack
   ══════════════════════════════════════════ */

/** Environment card appear */
export const envAppear = {
    initial: { opacity: 0, scale: 0.9, x: -16 },
    animate: { opacity: 1, scale: 1, x: 0 },
    exit: { opacity: 0, scale: 0.9, x: 16 },
};

/** Call stack entry slide in from bottom */
export const stackSlideIn = {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -12, scale: 0.95 },
};

/* ══════════════════════════════════════════
   Evaluation / Control Flow (Cinematic)
   ══════════════════════════════════════════ */

/** Eval bubble float-in */
export const evalBubbleAppear = {
    initial: { opacity: 0, y: 16, scale: 0.94 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.94 },
};

/** Result badge pop-in */
export const resultBadgeAppear = {
    initial: { opacity: 0, scale: 0.6 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.6 },
};

/** Control flow card slide-in */
export const flowCardAppear = {
    initial: { opacity: 0, y: 14, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.96 },
};
