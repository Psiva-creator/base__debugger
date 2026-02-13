import Editor from '@monaco-editor/react';

type SourceEditorProps = {
    readonly value: string;
    readonly onChange?: (value: string) => void;
};

export function SourceEditor({ value, onChange }: SourceEditorProps) {
    return (
        <Editor
            height="100%"
            language="python"
            theme="vs-dark"
            value={value}
            onChange={(v) => onChange?.(v ?? '')}
            options={{
                readOnly: false,
                minimap: { enabled: false },
                fontSize: 15,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                renderLineHighlight: 'none',
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                scrollbar: {
                    vertical: 'hidden',
                    horizontal: 'hidden',
                },
                padding: { top: 16, bottom: 16 },
                contextmenu: false,
            }}
        />
    );
}
