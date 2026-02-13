// ─────────────────────────────────────────────
// ChronoVM Test: Control Flow (no PRINT, integers only)
// ─────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { runVM, Opcode, heapRead, VMError, VMErrorType } from '../src/index.ts';
import type { IRInstruction, HeapAddress } from '../src/index.ts';

/** Read the top value from finalState operandStack. */
function topValue(result: ReturnType<typeof runVM>): unknown {
    const stack = result.finalState.operandStack;
    const addr = stack[stack.length - 1]!;
    return heapRead(result.finalState, addr as HeapAddress, 0, 0, null);
}

describe('Control Flow', () => {
    it('JUMP moves PC to target', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.JUMP, target: 2 },           // 0: jump to 2
            { opcode: Opcode.LOAD_CONST, value: 1 },      // 1: skipped
            { opcode: Opcode.LOAD_CONST, value: 2 },      // 2: target
            { opcode: Opcode.HALT },                        // 3
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(2);
    });

    it('JUMP_IF_FALSE jumps when value is false', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: false },  // 0
            { opcode: Opcode.JUMP_IF_FALSE, target: 4 },  // 1: should jump
            { opcode: Opcode.LOAD_CONST, value: 11 },     // 2: skipped
            { opcode: Opcode.JUMP, target: 5 },            // 3: skipped
            { opcode: Opcode.LOAD_CONST, value: 22 },     // 4: target
            { opcode: Opcode.HALT },                        // 5
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(22);
    });

    it('JUMP_IF_FALSE jumps when value is 0', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 0 },
            { opcode: Opcode.JUMP_IF_FALSE, target: 3 },
            { opcode: Opcode.LOAD_CONST, value: 11 },     // skipped
            { opcode: Opcode.LOAD_CONST, value: 33 },     // target
            { opcode: Opcode.HALT },
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(33);
    });

    it('JUMP_IF_FALSE falls through when value is true', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: true },   // 0
            { opcode: Opcode.JUMP_IF_FALSE, target: 4 },  // 1: should NOT jump
            { opcode: Opcode.LOAD_CONST, value: 44 },     // 2: reached
            { opcode: Opcode.HALT },                        // 3
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(44);
    });

    it('JUMP_IF_FALSE falls through when value is nonzero number', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 42 },
            { opcode: Opcode.JUMP_IF_FALSE, target: 4 },
            { opcode: Opcode.LOAD_CONST, value: 55 },
            { opcode: Opcode.HALT },
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(55);
    });

    it('simple loop: sums 1+2+3 = 6', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 0 },       // 0: sum=0
            { opcode: Opcode.STORE, name: 'sum' },          // 1
            { opcode: Opcode.LOAD_CONST, value: 1 },       // 2: i=1
            { opcode: Opcode.STORE, name: 'i' },            // 3

            // Loop condition (pc=4)
            { opcode: Opcode.LOAD_CONST, value: 4 },       // 4
            { opcode: Opcode.LOAD, name: 'i' },             // 5
            { opcode: Opcode.SUB },                          // 6: 4-i
            { opcode: Opcode.JUMP_IF_FALSE, target: 16 },   // 7: exit

            // Body: sum = sum + i
            { opcode: Opcode.LOAD, name: 'sum' },           // 8
            { opcode: Opcode.LOAD, name: 'i' },             // 9
            { opcode: Opcode.ADD },                          // 10
            { opcode: Opcode.STORE, name: 'sum' },          // 11

            // Body: i = i + 1
            { opcode: Opcode.LOAD, name: 'i' },             // 12
            { opcode: Opcode.LOAD_CONST, value: 1 },       // 13
            { opcode: Opcode.ADD },                          // 14
            { opcode: Opcode.STORE, name: 'i' },            // 15

            // Loop back
            { opcode: Opcode.JUMP, target: 4 },             // 16... wait

            // Exit: load sum
            { opcode: Opcode.LOAD, name: 'sum' },           // 17
            { opcode: Opcode.HALT },                         // 18
        ];

        // Fix: target 16 should be the JUMP back; exit should be 17
        const fixedProgram: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 0 },       // 0
            { opcode: Opcode.STORE, name: 'sum' },          // 1
            { opcode: Opcode.LOAD_CONST, value: 1 },       // 2
            { opcode: Opcode.STORE, name: 'i' },            // 3

            { opcode: Opcode.LOAD_CONST, value: 4 },       // 4
            { opcode: Opcode.LOAD, name: 'i' },             // 5
            { opcode: Opcode.SUB },                          // 6
            { opcode: Opcode.JUMP_IF_FALSE, target: 17 },   // 7: exit to LOAD sum

            { opcode: Opcode.LOAD, name: 'sum' },           // 8
            { opcode: Opcode.LOAD, name: 'i' },             // 9
            { opcode: Opcode.ADD },                          // 10
            { opcode: Opcode.STORE, name: 'sum' },          // 11

            { opcode: Opcode.LOAD, name: 'i' },             // 12
            { opcode: Opcode.LOAD_CONST, value: 1 },       // 13
            { opcode: Opcode.ADD },                          // 14
            { opcode: Opcode.STORE, name: 'i' },            // 15

            { opcode: Opcode.JUMP, target: 4 },             // 16

            // Exit
            { opcode: Opcode.LOAD, name: 'sum' },           // 17
            { opcode: Opcode.HALT },                         // 18
        ];

        const result = runVM(fixedProgram);
        expect(topValue(result)).toBe(6);
    });

    it('HALT stops execution', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 77 },
            { opcode: Opcode.HALT },
            { opcode: Opcode.LOAD_CONST, value: 88 }, // never reached
        ];

        const result = runVM(program);
        expect(result.finalState.isRunning).toBe(false);
        expect(topValue(result)).toBe(77); // only the first LOAD_CONST ran
    });

    it('trace captures correct number of snapshots', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 1 },  // step 0
            { opcode: Opcode.LOAD_CONST, value: 2 },  // step 1
            { opcode: Opcode.ADD },                     // step 2
            { opcode: Opcode.HALT },                    // step 3
        ];

        const result = runVM(program);
        // 4 pre-step snapshots + 1 final = 5
        expect(result.trace.snapshots.length).toBe(5);
    });

    it('throws UnboundVariable for undefined variable', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD, name: 'missing' },
            { opcode: Opcode.HALT },
        ];

        try {
            runVM(program);
            expect.fail('Should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(VMError);
            expect((e as VMError).data.type).toBe(VMErrorType.UNBOUND_VARIABLE);
        }
    });
});
