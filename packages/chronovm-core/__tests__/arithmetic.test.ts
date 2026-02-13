// ─────────────────────────────────────────────
// ChronoVM Test: Arithmetic (no PRINT, check stack)
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

describe('Arithmetic', () => {
    it('ADD: 10 + 20 = 30', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 10 },
            { opcode: Opcode.LOAD_CONST, value: 20 },
            { opcode: Opcode.ADD },
            { opcode: Opcode.HALT },
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(30);
    });

    it('SUB: 50 - 8 = 42', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 50 },
            { opcode: Opcode.LOAD_CONST, value: 8 },
            { opcode: Opcode.SUB },
            { opcode: Opcode.HALT },
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(42);
    });

    it('MUL: 6 * 7 = 42', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 6 },
            { opcode: Opcode.LOAD_CONST, value: 7 },
            { opcode: Opcode.MUL },
            { opcode: Opcode.HALT },
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(42);
    });

    it('DIV: 84 / 2 = 42', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 84 },
            { opcode: Opcode.LOAD_CONST, value: 2 },
            { opcode: Opcode.DIV },
            { opcode: Opcode.HALT },
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(42);
    });

    it('chained arithmetic: (3 + 4) * 6 = 42', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 3 },
            { opcode: Opcode.LOAD_CONST, value: 4 },
            { opcode: Opcode.ADD },
            { opcode: Opcode.LOAD_CONST, value: 6 },
            { opcode: Opcode.MUL },
            { opcode: Opcode.HALT },
        ];

        const result = runVM(program);
        expect(topValue(result)).toBe(42);
    });

    it('throws DivisionByZero on divide by 0', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 10 },
            { opcode: Opcode.LOAD_CONST, value: 0 },
            { opcode: Opcode.DIV },
            { opcode: Opcode.HALT },
        ];

        try {
            runVM(program);
            expect.fail('Should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(VMError);
            expect((e as VMError).data.type).toBe(VMErrorType.DIVISION_BY_ZERO);
        }
    });

    it('throws StackUnderflow on ADD with empty stack', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.ADD },
            { opcode: Opcode.HALT },
        ];

        try {
            runVM(program);
            expect.fail('Should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(VMError);
            expect((e as VMError).data.type).toBe(VMErrorType.STACK_UNDERFLOW);
        }
    });

    it('throws StackUnderflow on ADD with only one operand', () => {
        const program: IRInstruction[] = [
            { opcode: Opcode.LOAD_CONST, value: 5 },
            { opcode: Opcode.ADD },
            { opcode: Opcode.HALT },
        ];

        try {
            runVM(program);
            expect.fail('Should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(VMError);
            expect((e as VMError).data.type).toBe(VMErrorType.STACK_UNDERFLOW);
        }
    });
});
