"use client";

import { useRef, useCallback } from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
            Loading editor...
        </div>
    ),
});

interface SourceEditorProps {
    value: string;
    onChange: (value: string) => void;
}

export function SourceEditor({ value, onChange }: SourceEditorProps) {
    const handleChange = useCallback(
        (val: string | undefined) => {
            onChange(val ?? "");
        },
        [onChange]
    );

    return (
        <MonacoEditor
            height="100%"
            language="python"
            theme="vs-dark"
            value={value}
            onChange={handleChange}
            options={{
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: 14,
                lineHeight: 22,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12 },
                roundedSelection: true,
                renderLineHighlight: "gutter",
                automaticLayout: true,
                tabSize: 4,
                wordWrap: "on",
            }}
        />
    );
}
