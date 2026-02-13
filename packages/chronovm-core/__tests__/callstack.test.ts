// ─────────────────────────────────────────────
// ChronoVM Test: CALL / RET (immutable, no PRINT)
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { runVM, Opcode, heapRead } from '../src/index.ts';
import type { IRInstruction, HeapAddress } from '../src/index.ts';

function stripBrands(obj: unknown): unknown {
    return JSON.parse(JSON.stringify(obj));
}

/** Read the top value from finalState operandStack. */
function topValue(result: ReturnType<typeof runVM>): unknown {
    const stack = result.finalState.operandStack;
    const addr = stack[stack.length - 1]!;
    return heapRead(result.finalState, addr as HeapAddress, 0, 0, null);
}

describe('CALL / RET (closure-aware)', () => {
    it('single CALL/RET roundtrip', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 10 },          // 0
            { opcode: Opcode.MAKE_FUNCTION, entry: 5 },         // 1
            { opcode: Opcode.CALL, argCount: 1 },               // 2
            { opcode: Opcode.HALT },                             // 3
            { opcode: Opcode.HALT },                             // 4 (guard)
            // fn@5: arg0 + 1
            { opcode: Opcode.LOAD, name: 'arg0' },              // 5
            { opcode: Opcode.LOAD_CONST, value: 1 },           // 6
            { opcode: Opcode.ADD },                              // 7
            { opcode: Opcode.RET },                              // 8
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(11);
        expect(result.finalState.callStack.length).toBe(0);
    });

    it('nested calls', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.MAKE_FUNCTION, entry: 4 },        // 0: outer
            { opcode: Opcode.CALL, argCount: 0 },               // 1
            { opcode: Opcode.HALT },                             // 2
            { opcode: Opcode.HALT },                             // 3 (guard)
            // outer@4
            { opcode: Opcode.MAKE_FUNCTION, entry: 8 },        // 4: inner
            { opcode: Opcode.CALL, argCount: 0 },               // 5
            { opcode: Opcode.RET },                              // 6
            { opcode: Opcode.HALT },                             // 7
            // inner@8
            { opcode: Opcode.LOAD_CONST, value: 42 },          // 8
            { opcode: Opcode.RET },                              // 9
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(42);
    });

    it('recursive factorial of 4 = 24', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.MAKE_FUNCTION, entry: 7 },         // 0
            { opcode: Opcode.STORE, name: 'factorial' },         // 1
            { opcode: Opcode.LOAD_CONST, value: 4 },            // 2
            { opcode: Opcode.LOAD, name: 'factorial' },          // 3
            { opcode: Opcode.CALL, argCount: 1 },                // 4
            { opcode: Opcode.HALT },                              // 5
            { opcode: Opcode.HALT },                              // 6

            // factorial@7
            { opcode: Opcode.LOAD, name: 'arg0' },               // 7
            { opcode: Opcode.JUMP_IF_FALSE, target: 17 },        // 8: if n==0

            { opcode: Opcode.LOAD, name: 'arg0' },               // 9
            { opcode: Opcode.LOAD, name: 'arg0' },               // 10
            { opcode: Opcode.LOAD_CONST, value: 1 },            // 11
            { opcode: Opcode.SUB },                               // 12: n-1
            { opcode: Opcode.LOAD, name: 'factorial' },          // 13
            { opcode: Opcode.CALL, argCount: 1 },                // 14: factorial(n-1)
            { opcode: Opcode.MUL },                               // 15: n * factorial(n-1)
            { opcode: Opcode.RET },                               // 16

            // base case @17
            { opcode: Opcode.LOAD_CONST, value: 1 },            // 17
            { opcode: Opcode.RET },                               // 18
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(24);
    });

    it('deterministic callStack depth during recursion', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.MAKE_FUNCTION, entry: 3 },   // 0
            { opcode: Opcode.CALL, argCount: 0 },          // 1
            { opcode: Opcode.HALT },                        // 2

            // level1@3
            { opcode: Opcode.MAKE_FUNCTION, entry: 7 },   // 3
            { opcode: Opcode.CALL, argCount: 0 },          // 4
            { opcode: Opcode.RET },                         // 5
            { opcode: Opcode.HALT },                        // 6

            // level2@7
            { opcode: Opcode.MAKE_FUNCTION, entry: 11 },  // 7
            { opcode: Opcode.CALL, argCount: 0 },          // 8
            { opcode: Opcode.RET },                         // 9
            { opcode: Opcode.HALT },                        // 10

            // level3@11
            { opcode: Opcode.LOAD_CONST, value: 99 },     // 11
            { opcode: Opcode.RET },                         // 12
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(99);

        let maxDepth = 0;
        for (const snap of result.trace.snapshots) {
            if (snap.callStack.length > maxDepth) {
                maxDepth = snap.callStack.length;
            }
        }
        expect(maxDepth).toBe(3);
    });

    it('environment is properly restored after RET', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 100 },       // 0
            { opcode: Opcode.STORE, name: 'x' },             // 1
            { opcode: Opcode.MAKE_FUNCTION, entry: 6 },      // 2
            { opcode: Opcode.CALL, argCount: 0 },             // 3
            { opcode: Opcode.LOAD, name: 'x' },              // 4
            { opcode: Opcode.HALT },                           // 5
            // fn@6
            { opcode: Opcode.LOAD_CONST, value: 999 },       // 6
            { opcode: Opcode.STORE, name: 'x' },             // 7
            { opcode: Opcode.RET },                            // 8
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(100);
    });

    it('identical traces across 3 runs', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 5 },
            { opcode: Opcode.MAKE_FUNCTION, entry: 4 },
            { opcode: Opcode.CALL, argCount: 1 },
            { opcode: Opcode.HALT },
            // double@4
            { opcode: Opcode.LOAD, name: 'arg0' },
            { opcode: Opcode.LOAD, name: 'arg0' },
            { opcode: Opcode.ADD },
            { opcode: Opcode.RET },
        ];

        const traces = [];
        for (let i = 0; i < 3; i++) {
            traces.push(stripBrands(runVM(program).trace));
        }
        expect(traces[0]).toEqual(traces[1]);
        expect(traces[1]).toEqual(traces[2]);
    });

    it('RET with empty callStack halts', () => {
        const result = runVM([{ opcode: Opcode.RET }]);
        expect(result.finalState.isRunning).toBe(false);
    });

    it('multi-arg binding', () => {
        // fn(10, 20): store arg0 as a, store arg1 as b, return a + b
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 10 },     // 0
            { opcode: Opcode.LOAD_CONST, value: 20 },     // 1
            { opcode: Opcode.MAKE_FUNCTION, entry: 5 },    // 2
            { opcode: Opcode.CALL, argCount: 2 },          // 3
            { opcode: Opcode.HALT },                        // 4
            // fn@5
            { opcode: Opcode.LOAD, name: 'arg0' },        // 5
            { opcode: Opcode.LOAD, name: 'arg1' },        // 6
            { opcode: Opcode.ADD },                         // 7
            { opcode: Opcode.RET },                         // 8
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(30);
    });
});
