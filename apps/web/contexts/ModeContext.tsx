"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

// ── Mode Types ──

export type ViewMode = "learning" | "pro";

export type PanelId =
    | "memory"
    | "controlFlow"
    | "variables"
    | "stack"
    | "instructions"
    | "narration"
    | "output";

export type PanelModeMap = Readonly<Record<PanelId, ViewMode>>;

const ALL_PANELS: readonly PanelId[] = [
    "memory",
    "controlFlow",
    "variables",
    "stack",
    "instructions",
    "narration",
    "output",
];

const DEFAULT_PANEL_MODES: PanelModeMap = {
    memory: "learning",
    controlFlow: "learning",
    variables: "learning",
    stack: "learning",
    instructions: "learning",
    narration: "learning",
    output: "learning",
};

// ── Context Value ──

interface PanelModeContextValue {
    readonly panelModes: PanelModeMap;
    readonly setPanelMode: (panel: PanelId, mode: ViewMode) => void;
    readonly resetAllPanels: (mode: ViewMode) => void;
    readonly syncAllPanelsTo: (mode: ViewMode) => void;
}

const PanelModeContext = createContext<PanelModeContextValue>({
    panelModes: DEFAULT_PANEL_MODES,
    setPanelMode: () => { },
    resetAllPanels: () => { },
    syncAllPanelsTo: () => { },
});

// ── Provider ──

export function PanelModeProvider({ children }: { children: ReactNode }) {
    const [panelModes, setPanelModes] = useState<PanelModeMap>(DEFAULT_PANEL_MODES);

    const setPanelMode = useCallback((panel: PanelId, mode: ViewMode) => {
        setPanelModes((prev) => {
            if (prev[panel] === mode) return prev; // no-op, preserve reference
            return { ...prev, [panel]: mode };
        });
    }, []);

    const resetAllPanels = useCallback((mode: ViewMode) => {
        setPanelModes((prev) => {
            // Check if already all set to this mode
            const allSame = ALL_PANELS.every((p) => prev[p] === mode);
            if (allSame) return prev;

            const next = {} as Record<PanelId, ViewMode>;
            for (const p of ALL_PANELS) next[p] = mode;
            return next as PanelModeMap;
        });
    }, []);

    // Semantic alias
    const syncAllPanelsTo = resetAllPanels;

    const value = useMemo<PanelModeContextValue>(
        () => ({ panelModes, setPanelMode, resetAllPanels, syncAllPanelsTo }),
        [panelModes, setPanelMode, resetAllPanels, syncAllPanelsTo],
    );

    return (
        <PanelModeContext.Provider value={value}>
            {children}
        </PanelModeContext.Provider>
    );
}

// ── Hooks ──

/** Read the entire panel mode map + bulk operations */
export function usePanelModes() {
    return useContext(PanelModeContext);
}

/** Scoped hook — reads only one panel's mode. Minimises re-renders. */
export function usePanelMode(panelId: PanelId) {
    const { panelModes, setPanelMode } = useContext(PanelModeContext);
    const mode = panelModes[panelId];

    const setMode = useCallback(
        (m: ViewMode) => setPanelMode(panelId, m),
        [setPanelMode, panelId],
    );

    const toggle = useCallback(
        () => setPanelMode(panelId, mode === "learning" ? "pro" : "learning"),
        [setPanelMode, panelId, mode],
    );

    return useMemo(() => ({ mode, setMode, toggle }), [mode, setMode, toggle]);
}

// ── Legacy compatibility ──

/** @deprecated Use usePanelMode(panelId) or usePanelModes() instead */
export function useMode() {
    const { panelModes, syncAllPanelsTo } = useContext(PanelModeContext);
    // Derive a "global" mode: if all panels agree, use that; otherwise default to first panel
    const allLearning = ALL_PANELS.every((p) => panelModes[p] === "learning");
    const mode: ViewMode = allLearning ? "learning" : "pro";

    return {
        mode,
        setMode: syncAllPanelsTo,
        toggleMode: () => syncAllPanelsTo(mode === "learning" ? "pro" : "learning"),
    };
}
