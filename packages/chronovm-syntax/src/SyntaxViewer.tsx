import { useState, useEffect, useMemo } from 'react';
import { createHighlighter, type Highlighter } from 'shiki';
import './SyntaxViewer.css';

export type SyntaxViewerProps = {
    readonly sourceCode: string;
    readonly language?: string;
    readonly theme?: 'dark' | 'light';
    readonly activeLine?: number;
    readonly changedLines?: number[];
};

const THEME_MAP = {
    dark: 'github-dark',
    light: 'github-light',
} as const;

let highlighterPromise: Promise<Highlighter> | null = null;

function getCachedHighlighter(): Promise<Highlighter> {
    if (!highlighterPromise) {
        highlighterPromise = createHighlighter({
            themes: ['github-dark', 'github-light'],
            langs: ['python'],
        });
    }
    return highlighterPromise;
}

function parseHighlightedLines(html: string): string[] {
    const parts = html.split(/<span class="line">/).slice(1);
    return parts.map((part) => {
        const endIdx = part.lastIndexOf('</span>');
        return endIdx >= 0 ? part.substring(0, endIdx) : part;
    });
}

export function SyntaxViewer({
    sourceCode,
    language = 'python',
    theme = 'dark',
    activeLine,
    changedLines = [],
}: SyntaxViewerProps) {
    const [highlightedLines, setHighlightedLines] = useState<string[] | null>(null);
    const [bgColor, setBgColor] = useState<string>(theme === 'dark' ? '#24292e' : '#ffffff');
    const [error, setError] = useState<string | null>(null);

    const changedSet = useMemo(() => new Set(changedLines), [changedLines]);
    const shikiTheme = THEME_MAP[theme];

    useEffect(() => {
        let cancelled = false;

        async function highlight() {
            try {
                const highlighter = await getCachedHighlighter();
                if (cancelled) return;

                const html = highlighter.codeToHtml(sourceCode, {
                    lang: language,
                    theme: shikiTheme,
                });

                const themeObj = highlighter.getTheme(shikiTheme);
                setBgColor(themeObj.bg || '#24292e');

                const parsed = parseHighlightedLines(html);
                if (parsed.length > 0) {
                    setHighlightedLines(parsed);
                } else {
                    setHighlightedLines(null);
                }
                setError(null);
            } catch (err) {
                if (!cancelled) {
                    console.error('[SyntaxViewer] Shiki error:', err);
                    setError(String(err));
                    setHighlightedLines(null);
                }
            }
        }

        highlight();

        return () => {
            cancelled = true;
        };
    }, [sourceCode, language, shikiTheme]);

    const sourceLines = sourceCode.split('\n');
    const displayLines = highlightedLines ?? sourceLines;
    const isHighlighted = highlightedLines !== null;

    return (
        <div
            className={`syntax-viewer syntax-viewer--${theme}`}
            style={{ backgroundColor: bgColor }}
        >
            {error && (
                <div className="syntax-viewer__error">
                    Highlighting unavailable: {error}
                </div>
            )}
            <div className="syntax-viewer__code">
                {displayLines.map((lineContent, i) => {
                    const lineNum = i + 1;
                    const isActive = activeLine === lineNum;
                    const isChanged = changedSet.has(lineNum);

                    let className = 'syntax-viewer__line';
                    if (isActive) className += ' syntax-viewer__line--active';
                    if (isChanged) className += ' syntax-viewer__line--changed';

                    return (
                        <div key={i} className={className}>
                            <span className="syntax-viewer__line-number">
                                {lineNum}
                            </span>
                            {isHighlighted ? (
                                <span
                                    className="syntax-viewer__line-content"
                                    dangerouslySetInnerHTML={{ __html: lineContent }}
                                />
                            ) : (
                                <span className="syntax-viewer__line-content">
                                    {lineContent}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
