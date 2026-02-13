// ─────────────────────────────────────────────
// ChronoVM Test: Environment (Immutable API)
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
    createInitialState,
    createEnvironment,
    envBind,
    envLookup,
    heapAlloc,
} from '../src/index.ts';

describe('Environment', () => {
    it('binds and resolves a variable in the global scope', () => {
        const program = [{ opcode: 'HALT' as const }];
        let state = createInitialState(program);

        const r = heapAlloc(state, 42);
        state = r.state;
        state = envBind(state, state.globalEnvironment, 'x', r.address);

        const result = envLookup(state, state.globalEnvironment, 'x');
        expect(result).toBe(r.address);
    });

    it('returns null for unbound variable', () => {
        const program = [{ opcode: 'HALT' as const }];
        const state = createInitialState(program);

        const result = envLookup(state, state.globalEnvironment, 'nonexistent');
        expect(result).toBeNull();
    });

    it('child environment shadows parent binding', () => {
        const program = [{ opcode: 'HALT' as const }];
        let state = createInitialState(program);

        // Bind x=10 in global
        const rGlobal = heapAlloc(state, 10);
        state = rGlobal.state;
        state = envBind(state, state.globalEnvironment, 'x', rGlobal.address);

        // Create child scope, bind x=20
        const childResult = createEnvironment(state, state.globalEnvironment);
        state = childResult.state;
        const childEnv = childResult.address;

        const rChild = heapAlloc(state, 20);
        state = rChild.state;
        state = envBind(state, childEnv, 'x', rChild.address);

        // Child sees its own x
        expect(envLookup(state, childEnv, 'x')).toBe(rChild.address);
        // Parent still sees its own x
        expect(envLookup(state, state.globalEnvironment, 'x')).toBe(rGlobal.address);
    });

    it('child environment resolves parent binding when not shadowed', () => {
        const program = [{ opcode: 'HALT' as const }];
        let state = createInitialState(program);

        const r = heapAlloc(state, 99);
        state = r.state;
        state = envBind(state, state.globalEnvironment, 'y', r.address);

        const childResult = createEnvironment(state, state.globalEnvironment);
        state = childResult.state;

        expect(envLookup(state, childResult.address, 'y')).toBe(r.address);
    });

    it('three-level scope chain resolves correctly', () => {
        const program = [{ opcode: 'HALT' as const }];
        let state = createInitialState(program);

        // global: a=1
        const rA = heapAlloc(state, 1);
        state = rA.state;
        state = envBind(state, state.globalEnvironment, 'a', rA.address);

        // child1: b=2
        const c1Result = createEnvironment(state, state.globalEnvironment);
        state = c1Result.state;
        const child1 = c1Result.address;
        const rB = heapAlloc(state, 2);
        state = rB.state;
        state = envBind(state, child1, 'b', rB.address);

        // child2: c=3
        const c2Result = createEnvironment(state, child1);
        state = c2Result.state;
        const child2 = c2Result.address;
        const rC = heapAlloc(state, 3);
        state = rC.state;
        state = envBind(state, child2, 'c', rC.address);

        // From child2, all three
        expect(envLookup(state, child2, 'a')).toBe(rA.address);
        expect(envLookup(state, child2, 'b')).toBe(rB.address);
        expect(envLookup(state, child2, 'c')).toBe(rC.address);

        // From child1, only a and b
        expect(envLookup(state, child1, 'a')).toBe(rA.address);
        expect(envLookup(state, child1, 'b')).toBe(rB.address);
        expect(envLookup(state, child1, 'c')).toBeNull();
    });

    it('envCounter is separate and deterministic', () => {
        const program = [{ opcode: 'HALT' as const }];
        let state = createInitialState(program);

        // After init: global env = env@0, envCounter = 1
        expect(state.globalEnvironment).toBe('env@0');
        expect(state.envCounter).toBe(1);

        const c1 = createEnvironment(state, state.globalEnvironment);
        state = c1.state;
        expect(c1.address).toBe('env@1');
        expect(state.envCounter).toBe(2);

        const c2 = createEnvironment(state, state.globalEnvironment);
        expect(c2.address).toBe('env@2');
        expect(c2.state.envCounter).toBe(3);

        // Heap counter should be unaffected
        expect(c2.state.allocationCounter).toBe(0);
    });
});
