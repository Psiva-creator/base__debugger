// ─────────────────────────────────────────────
// ChronoVM Error Taxonomy
// ─────────────────────────────────────────────
// Errors are structured data, not opaque strings.
// Every error carries full context for debugging.
// ─────────────────────────────────────────────

import type { IRInstruction } from '../ir/instructions.ts';

export const VMErrorType = {
    STACK_UNDERFLOW: 'STACK_UNDERFLOW',
    INVALID_OPCODE: 'INVALID_OPCODE',
    UNBOUND_VARIABLE: 'UNBOUND_VARIABLE',
    DIVISION_BY_ZERO: 'DIVISION_BY_ZERO',
    HEAP_ACCESS_VIOLATION: 'HEAP_ACCESS_VIOLATION',
    PC_OUT_OF_BOUNDS: 'PC_OUT_OF_BOUNDS',
    TYPE_ERROR: 'TYPE_ERROR',
    INVALID_OBJECT_ACCESS: 'INVALID_OBJECT_ACCESS',
    PROPERTY_NOT_FOUND: 'PROPERTY_NOT_FOUND',
} as const;

export type VMErrorType = (typeof VMErrorType)[keyof typeof VMErrorType];

/**
 * Structured VM error.
 * Thrown only inside step(). Contains full execution context.
 */
export type VMErrorData = {
    readonly type: VMErrorType;
    readonly message: string;
    readonly pc: number;
    readonly stepCount: number;
    readonly instruction: IRInstruction | null;
};

/**
 * VMError extends Error for catch compatibility,
 * but carries structured data for programmatic access.
 */
export class VMError extends Error {
    readonly data: VMErrorData;

    constructor(data: VMErrorData) {
        super(`[ChronoVM ${data.type}] ${data.message} (pc=${data.pc}, step=${data.stepCount})`);
        this.name = 'VMError';
        this.data = data;
    }
}

// ─────────────────────────────────────────────
// Factory helpers
// ─────────────────────────────────────────────

export function stackUnderflow(
    pc: number,
    stepCount: number,
    instruction: IRInstruction,
): VMError {
    return new VMError({
        type: VMErrorType.STACK_UNDERFLOW,
        message: `Operand stack underflow while executing ${instruction.opcode}`,
        pc,
        stepCount,
        instruction,
    });
}

export function invalidOpcode(
    pc: number,
    stepCount: number,
    instruction: IRInstruction,
): VMError {
    return new VMError({
        type: VMErrorType.INVALID_OPCODE,
        message: `Unsupported opcode: ${instruction.opcode}`,
        pc,
        stepCount,
        instruction,
    });
}

export function unboundVariable(
    pc: number,
    stepCount: number,
    instruction: IRInstruction,
    name: string,
): VMError {
    return new VMError({
        type: VMErrorType.UNBOUND_VARIABLE,
        message: `Variable "${name}" is not defined in any reachable scope`,
        pc,
        stepCount,
        instruction,
    });
}

export function divisionByZero(
    pc: number,
    stepCount: number,
    instruction: IRInstruction,
): VMError {
    return new VMError({
        type: VMErrorType.DIVISION_BY_ZERO,
        message: `Division by zero`,
        pc,
        stepCount,
        instruction,
    });
}

export function heapAccessViolation(
    pc: number,
    stepCount: number,
    instruction: IRInstruction | null,
    address: string,
): VMError {
    return new VMError({
        type: VMErrorType.HEAP_ACCESS_VIOLATION,
        message: `Invalid heap address: "${address}"`,
        pc,
        stepCount,
        instruction,
    });
}

export function pcOutOfBounds(
    pc: number,
    stepCount: number,
    programLength: number,
): VMError {
    return new VMError({
        type: VMErrorType.PC_OUT_OF_BOUNDS,
        message: `Program counter ${pc} out of bounds [0, ${programLength - 1}]`,
        pc,
        stepCount,
        instruction: null,
    });
}

export function typeError(
    pc: number,
    stepCount: number,
    instruction: IRInstruction,
    message: string,
): VMError {
    return new VMError({
        type: VMErrorType.TYPE_ERROR,
        message,
        pc,
        stepCount,
        instruction,
    });
}

export function invalidObjectAccess(
    pc: number,
    stepCount: number,
    instruction: IRInstruction,
    message: string,
): VMError {
    return new VMError({
        type: VMErrorType.INVALID_OBJECT_ACCESS,
        message,
        pc,
        stepCount,
        instruction,
    });
}

export function propertyNotFound(
    pc: number,
    stepCount: number,
    instruction: IRInstruction,
    name: string,
): VMError {
    return new VMError({
        type: VMErrorType.PROPERTY_NOT_FOUND,
        message: `Property "${name}" not found on object`,
        pc,
        stepCount,
        instruction,
    });
}
