"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ── Mode Types ──

export type ViewMode = "learning" | "pro";

interface ModeContextValue {
    readonly mode: ViewMode;
    readonly setMode: (mode: ViewMode) => void;
    readonly toggleMode: () => void;
}

const ModeContext = createContext<ModeContextValue>({
    mode: "learning",
    setMode: () => { },
    toggleMode: () => { },
});

// ── Provider ──

export function ModeProvider({ children }: { children: ReactNode }) {
    const [mode, setModeRaw] = useState<ViewMode>("learning");

    const setMode = useCallback((m: ViewMode) => setModeRaw(m), []);
    const toggleMode = useCallback(
        () => setModeRaw((prev) => (prev === "learning" ? "pro" : "learning")),
        []
    );

    return (
        <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
            {children}
        </ModeContext.Provider>
    );
}

// ── Hook ──

export function useMode(): ModeContextValue {
    return useContext(ModeContext);
}
