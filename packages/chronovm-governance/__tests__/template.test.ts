// ─────────────────────────────────────────────
// Tests — Template Operations
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    createTemplate,
    updateTemplate,
    resetTemplate,
    diffTemplates,
} from '../src/template.ts';
import { DEFAULT_PANEL_MODES } from '../src/roles.ts';
import type { ProjectTemplateLayout } from '../src/template.ts';

function makeTemplate(overrides?: Partial<ProjectTemplateLayout>): ProjectTemplateLayout {
    return {
        ...createTemplate('proj1', 'owner1', '2026-01-01T00:00:00Z'),
        ...overrides,
    };
}

describe('createTemplate', () => {
    it('creates with system defaults', () => {
        const t = createTemplate('proj1', 'owner1', '2026-01-01T00:00:00Z');
        expect(t.projectId).toBe('proj1');
        expect(t.layoutVersion).toBe(1);
        expect(t.panelModes).toEqual(DEFAULT_PANEL_MODES);
        expect(t.lockedPanels).toEqual([]);
        expect(t.updatedBy).toBe('owner1');
    });
});

describe('updateTemplate', () => {
    it('owner can update panel modes', () => {
        const t = makeTemplate();
        const result = updateTemplate(
            t,
            { panelModes: { memory: 'pro' } },
            'owner1',
            'owner',
            '2026-01-01T01:00:00Z',
            'hash1',
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.template.panelModes.memory).toBe('pro');
            expect(result.template.panelModes.stack).toBe('learning'); // unchanged
            expect(result.template.layoutVersion).toBe(2);
        }
    });

    it('instructor can update panel modes', () => {
        const t = makeTemplate();
        const result = updateTemplate(
            t,
            { panelModes: { narration: 'pro' } },
            'teacher1',
            'instructor',
            '2026-01-01T01:00:00Z',
            'hash1',
        );
        expect(result.ok).toBe(true);
    });

    it('viewer cannot update template', () => {
        const t = makeTemplate();
        const result = updateTemplate(
            t,
            { panelModes: { memory: 'pro' } },
            'student1',
            'viewer',
            '2026-01-01T01:00:00Z',
            'hash1',
        );
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toContain('viewer');
        }
    });

    it('maintainer cannot update template', () => {
        const t = makeTemplate();
        const result = updateTemplate(
            t,
            { panelModes: { memory: 'pro' } },
            'ta1',
            'maintainer',
            '2026-01-01T01:00:00Z',
            'hash1',
        );
        expect(result.ok).toBe(false);
    });

    it('bumps layoutVersion', () => {
        const t = makeTemplate({ layoutVersion: 5 });
        const result = updateTemplate(
            t,
            { panelModes: { memory: 'pro' } },
            'owner1',
            'owner',
            '2026-01-01T01:00:00Z',
            'hash1',
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.template.layoutVersion).toBe(6);
        }
    });

    it('can lock panels', () => {
        const t = makeTemplate();
        const result = updateTemplate(
            t,
            { lockedPanels: ['memory', 'stack'] },
            'owner1',
            'owner',
            '2026-01-01T01:00:00Z',
            'hash1',
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.template.lockedPanels).toEqual(['memory', 'stack']);
        }
    });

    it('does not mutate original template', () => {
        const t = makeTemplate();
        const original = { ...t };
        updateTemplate(
            t,
            { panelModes: { memory: 'pro' } },
            'owner1',
            'owner',
            '2026-01-01T01:00:00Z',
            'hash1',
        );
        expect(t).toEqual(original);
    });
});

describe('resetTemplate', () => {
    it('owner can reset to defaults', () => {
        const t = makeTemplate({ panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro' } });
        const result = resetTemplate(t, 'owner1', 'owner', '2026-01-01T02:00:00Z', 'hash2');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.template.panelModes).toEqual(DEFAULT_PANEL_MODES);
            expect(result.template.lockedPanels).toEqual([]);
            expect(result.template.layoutVersion).toBe(t.layoutVersion + 1);
        }
    });

    it('instructor cannot reset', () => {
        const t = makeTemplate();
        const result = resetTemplate(t, 'teacher1', 'instructor', '2026-01-01T02:00:00Z', 'hash2');
        expect(result.ok).toBe(false);
    });
});

describe('diffTemplates', () => {
    it('detects changed panels', () => {
        const prev = makeTemplate();
        const next = makeTemplate({
            panelModes: { ...DEFAULT_PANEL_MODES, memory: 'pro', stack: 'pro' },
        });
        const diff = diffTemplates(prev, next);
        expect(diff.changedPanels).toContain('memory');
        expect(diff.changedPanels).toContain('stack');
        expect(diff.changedPanels).not.toContain('narration');
        expect(diff.before['memory']).toBe('learning');
        expect(diff.after['memory']).toBe('pro');
    });

    it('returns empty diff for identical templates', () => {
        const t = makeTemplate();
        const diff = diffTemplates(t, t);
        expect(diff.changedPanels).toEqual([]);
    });
});
