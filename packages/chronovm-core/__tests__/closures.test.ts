// ─────────────────────────────────────────────
// ChronoVM Test: Closures (immutable, no PRINT)
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

/** Read the Nth value from bottom of finalState operandStack. */
function stackValue(result: ReturnType<typeof runVM>, index: number): unknown {
    const addr = result.finalState.operandStack[index]!;
    return heapRead(result.finalState, addr as HeapAddress, 0, 0, null);
}

describe('Closures', () => {
    it('function captures outer variable (env reference, not value copy)', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 10 },       // 0
            { opcode: Opcode.STORE, name: 'a' },             // 1
            { opcode: Opcode.MAKE_FUNCTION, entry: 10 },     // 2: f
            { opcode: Opcode.STORE, name: 'f' },             // 3
            { opcode: Opcode.LOAD_CONST, value: 20 },       // 4
            { opcode: Opcode.STORE, name: 'a' },             // 5: rebind a=20
            { opcode: Opcode.LOAD, name: 'f' },              // 6
            { opcode: Opcode.CALL, argCount: 0 },             // 7
            { opcode: Opcode.HALT },                           // 8
            { opcode: Opcode.HALT },                           // 9
            // f@10
            { opcode: Opcode.LOAD, name: 'a' },              // 10
            { opcode: Opcode.RET },                            // 11
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(20); // env reference → sees latest
    });

    it('closure captures enclosing function scope', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 5 },        // 0
            { opcode: Opcode.MAKE_FUNCTION, entry: 5 },      // 1
            { opcode: Opcode.CALL, argCount: 1 },             // 2
            { opcode: Opcode.HALT },                           // 3
            { opcode: Opcode.HALT },                           // 4
            // outer@5
            { opcode: Opcode.LOAD, name: 'arg0' },           // 5
            { opcode: Opcode.STORE, name: 'x' },             // 6
            { opcode: Opcode.MAKE_FUNCTION, entry: 11 },      // 7
            { opcode: Opcode.CALL, argCount: 0 },             // 8
            { opcode: Opcode.RET },                            // 9
            { opcode: Opcode.HALT },                           // 10
            // inner@11
            { opcode: Opcode.LOAD, name: 'x' },              // 11
            { opcode: Opcode.RET },                            // 12
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(5);
    });

    it('returning a function and calling it later (makeAdder)', () => {
        const program: IRInstruction[] = [
            // main
            { opcode: Opcode.LOAD_CONST, value: 10 },       // 0
            { opcode: Opcode.MAKE_FUNCTION, entry: 9 },      // 1
            { opcode: Opcode.CALL, argCount: 1 },             // 2: makeAdder(10)
            { opcode: Opcode.STORE, name: 'adder' },          // 3
            { opcode: Opcode.LOAD_CONST, value: 5 },         // 4
            { opcode: Opcode.LOAD, name: 'adder' },           // 5
            { opcode: Opcode.CALL, argCount: 1 },              // 6: adder(5)
            { opcode: Opcode.HALT },                            // 7
            { opcode: Opcode.HALT },                            // 8
            // makeAdder@9
            { opcode: Opcode.LOAD, name: 'arg0' },            // 9
            { opcode: Opcode.STORE, name: 'n' },              // 10
            { opcode: Opcode.MAKE_FUNCTION, entry: 14 },      // 11
            { opcode: Opcode.RET },                             // 12
            { opcode: Opcode.HALT },                            // 13
            // inner@14: arg0 + n
            { opcode: Opcode.LOAD, name: 'arg0' },            // 14
            { opcode: Opcode.LOAD, name: 'n' },               // 15
            { opcode: Opcode.ADD },                             // 16
            { opcode: Opcode.RET },                             // 17
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(15);
    });

    it('lexical shadowing', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.MAKE_FUNCTION, entry: 3 },      // 0
            { opcode: Opcode.CALL, argCount: 0 },             // 1
            { opcode: Opcode.HALT },                           // 2
            // outer@3
            { opcode: Opcode.LOAD_CONST, value: 10 },        // 3
            { opcode: Opcode.STORE, name: 'x' },             // 4
            { opcode: Opcode.MAKE_FUNCTION, entry: 9 },       // 5
            { opcode: Opcode.CALL, argCount: 0 },             // 6
            { opcode: Opcode.RET },                            // 7
            { opcode: Opcode.HALT },                           // 8
            // inner@9
            { opcode: Opcode.LOAD_CONST, value: 99 },        // 9
            { opcode: Opcode.STORE, name: 'x' },             // 10
            { opcode: Opcode.LOAD, name: 'x' },              // 11
            { opcode: Opcode.RET },                            // 12
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(99);
    });

    it('multiple closure instances capture different values', () => {
        const program: IRInstruction[] = [
            // main
            { opcode: Opcode.MAKE_FUNCTION, entry: 15 },      // 0: makeConst
            { opcode: Opcode.STORE, name: 'makeConst' },       // 1
            { opcode: Opcode.LOAD_CONST, value: 100 },        // 2
            { opcode: Opcode.LOAD, name: 'makeConst' },        // 3
            { opcode: Opcode.CALL, argCount: 1 },               // 4: c1
            { opcode: Opcode.STORE, name: 'c1' },               // 5
            { opcode: Opcode.LOAD_CONST, value: 200 },        // 6
            { opcode: Opcode.LOAD, name: 'makeConst' },        // 7
            { opcode: Opcode.CALL, argCount: 1 },               // 8: c2
            { opcode: Opcode.STORE, name: 'c2' },               // 9
            { opcode: Opcode.LOAD, name: 'c1' },               // 10
            { opcode: Opcode.CALL, argCount: 0 },               // 11
            { opcode: Opcode.LOAD, name: 'c2' },               // 12
            { opcode: Opcode.CALL, argCount: 0 },               // 13
            { opcode: Opcode.HALT },                             // 14
            // makeConst@15
            { opcode: Opcode.LOAD, name: 'arg0' },             // 15
            { opcode: Opcode.STORE, name: 'v' },               // 16
            { opcode: Opcode.MAKE_FUNCTION, entry: 20 },       // 17
            { opcode: Opcode.RET },                              // 18
            { opcode: Opcode.HALT },                             // 19
            // getter@20
            { opcode: Opcode.LOAD, name: 'v' },                // 20
            { opcode: Opcode.RET },                              // 21
        ];

        const result = runVM(program);
        // Stack has [c1(), c2()] = [100, 200]
        expect(stackValue(result, 0)).toBe(100);
        expect(stackValue(result, 1)).toBe(200);
    });

    it('determinism across 3 runs', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 7 },
            { opcode: Opcode.STORE, name: 'x' },
            { opcode: Opcode.MAKE_FUNCTION, entry: 6 },
            { opcode: Opcode.CALL, argCount: 0 },
            { opcode: Opcode.HALT },
            { opcode: Opcode.HALT },
            // fn@6
            { opcode: Opcode.LOAD, name: 'x' },
            { opcode: Opcode.RET },
        ];

        const traces = [];
        for (let i = 0; i < 3; i++) {
            traces.push(stripBrands(runVM(program).trace));
        }
        expect(traces[0]).toEqual(traces[1]);
        expect(traces[1]).toEqual(traces[2]);
    });

    it('recursive closure (fibonacci)', () => {
        const program: IRInstruction[] = [
            // main
            { opcode: Opcode.MAKE_FUNCTION, entry: 6 },       // 0
            { opcode: Opcode.STORE, name: 'fib' },             // 1
            { opcode: Opcode.LOAD_CONST, value: 6 },          // 2
            { opcode: Opcode.LOAD, name: 'fib' },              // 3
            { opcode: Opcode.CALL, argCount: 1 },               // 4
            { opcode: Opcode.HALT },                             // 5
            // fib@6
            { opcode: Opcode.LOAD, name: 'arg0' },             // 6
            { opcode: Opcode.JUMP_IF_FALSE, target: 26 },      // 7: n==0 → ret 0
            { opcode: Opcode.LOAD, name: 'arg0' },             // 8
            { opcode: Opcode.LOAD_CONST, value: 1 },          // 9
            { opcode: Opcode.SUB },                              // 10: n-1
            { opcode: Opcode.JUMP_IF_FALSE, target: 28 },      // 11: n==1 → ret 1
            // fib(n-1)
            { opcode: Opcode.LOAD, name: 'arg0' },             // 12
            { opcode: Opcode.LOAD_CONST, value: 1 },          // 13
            { opcode: Opcode.SUB },                              // 14
            { opcode: Opcode.LOAD, name: 'fib' },              // 15
            { opcode: Opcode.CALL, argCount: 1 },               // 16
            // fib(n-2)
            { opcode: Opcode.LOAD, name: 'arg0' },             // 17
            { opcode: Opcode.LOAD_CONST, value: 2 },          // 18
            { opcode: Opcode.SUB },                              // 19
            { opcode: Opcode.LOAD, name: 'fib' },              // 20
            { opcode: Opcode.CALL, argCount: 1 },               // 21
            // add
            { opcode: Opcode.ADD },                              // 22
            { opcode: Opcode.RET },                              // 23
            { opcode: Opcode.HALT },                             // 24
            { opcode: Opcode.HALT },                             // 25
            // base0@26
            { opcode: Opcode.LOAD_CONST, value: 0 },          // 26
            { opcode: Opcode.RET },                              // 27
            // base1@28
            { opcode: Opcode.LOAD_CONST, value: 1 },          // 28
            { opcode: Opcode.RET },                              // 29
        ];

        const result = runVM(program, { maxSteps: 50_000 });
        expect(topValue(result)).toBe(8);
    });

    it('nested closure three levels deep', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.MAKE_FUNCTION, entry: 3 },        // 0
            { opcode: Opcode.CALL, argCount: 0 },               // 1
            { opcode: Opcode.HALT },                             // 2
            // a@3
            { opcode: Opcode.LOAD_CONST, value: 1 },           // 3
            { opcode: Opcode.STORE, name: 'x' },               // 4
            { opcode: Opcode.MAKE_FUNCTION, entry: 9 },         // 5
            { opcode: Opcode.CALL, argCount: 0 },               // 6
            { opcode: Opcode.RET },                              // 7
            { opcode: Opcode.HALT },                             // 8
            // b@9
            { opcode: Opcode.LOAD_CONST, value: 2 },           // 9
            { opcode: Opcode.STORE, name: 'y' },               // 10
            { opcode: Opcode.MAKE_FUNCTION, entry: 15 },        // 11
            { opcode: Opcode.CALL, argCount: 0 },               // 12
            { opcode: Opcode.RET },                              // 13
            { opcode: Opcode.HALT },                             // 14
            // c@15: x + y
            { opcode: Opcode.LOAD, name: 'x' },                // 15
            { opcode: Opcode.LOAD, name: 'y' },                // 16
            { opcode: Opcode.ADD },                              // 17
            { opcode: Opcode.RET },                              // 18
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(3);
    });
});
