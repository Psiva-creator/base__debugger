// ─────────────────────────────────────────────
// ChronoVM Step Executor
// ─────────────────────────────────────────────
// Executes exactly ONE instruction.
// PURE function: (state) → new state.
// No mutation. No external reads. No randomness.
// ─────────────────────────────────────────────

import { Opcode } from '../ir/instructions.ts';
import type { IRInstruction } from '../ir/instructions.ts';
import type { VMState } from './state.ts';
import type { HeapAddress, FunctionValue, ObjectValue } from './heap.ts';
import { heapAlloc, heapRead } from './heap.ts';
import { createEnvironment, envBind, envLookup } from './environment.ts';
import type { EnvironmentAddress } from './environment.ts';
import {
    stackUnderflow,
    divisionByZero,
    unboundVariable,
    pcOutOfBounds,
    invalidOpcode,
    typeError,
    invalidObjectAccess,
    propertyNotFound,
} from '../errors/vm-errors.ts';

/**
 * Pop one operand from the stack, read its heap value as a number.
 * Returns [value, remainingStack].
 */
function popNumber(
    state: VMState,
    instruction: IRInstruction,
): { value: number; stack: readonly HeapAddress[] } {
    if (state.operandStack.length === 0) {
        throw stackUnderflow(state.pc, state.stepCount, instruction);
    }
    const stack = [...state.operandStack];
    const address = stack.pop()!;
    const heapValue = heapRead(state, address, state.pc, state.stepCount, instruction);
    if (typeof heapValue !== 'number') {
        throw typeError(
            state.pc,
            state.stepCount,
            instruction,
            `Expected number on stack, got ${typeof heapValue}`,
        );
    }
    return { value: heapValue, stack };
}

/**
 * Pop one operand from the stack, read its heap value (any type).
 * Returns [value, address, remainingStack].
 */
function popValue(
    state: VMState,
    instruction: IRInstruction,
): { value: unknown; address: HeapAddress; stack: readonly HeapAddress[] } {
    if (state.operandStack.length === 0) {
        throw stackUnderflow(state.pc, state.stepCount, instruction);
    }
    const stack = [...state.operandStack];
    const address = stack.pop()!;
    const value = heapRead(state, address, state.pc, state.stepCount, instruction);
    return { value, address, stack };
}

/**
 * Execute a single instruction against the current VMState.
 *
 * PURE — returns a new VMState. Never mutates input.
 * Advances PC unless the instruction is a jump or halt.
 */
export function step(state: VMState): VMState {
    // ── Bounds check ──
    if (state.pc < 0 || state.pc >= state.program.length) {
        throw pcOutOfBounds(state.pc, state.stepCount, state.program.length);
    }

    const instruction = state.program[state.pc]!;

    switch (instruction.opcode) {
        // ── LOAD_CONST ──
        case Opcode.LOAD_CONST: {
            const { state: s1, address } = heapAlloc(state, instruction.value);
            return {
                ...s1,
                operandStack: [...s1.operandStack, address],
                pc: s1.pc + 1,
                stepCount: s1.stepCount + 1,
            };
        }

        // ── Arithmetic ──
        case Opcode.ADD: {
            const { value: right, stack: s1 } = popNumber(state, instruction);
            const stateAfterPop1 = { ...state, operandStack: s1 };
            const { value: left, stack: s2 } = popNumber(stateAfterPop1, instruction);
            const stateAfterPop2 = { ...stateAfterPop1, operandStack: s2 };
            const { state: s3, address } = heapAlloc(stateAfterPop2, left + right);
            return {
                ...s3,
                operandStack: [...s3.operandStack, address],
                pc: s3.pc + 1,
                stepCount: s3.stepCount + 1,
            };
        }

        case Opcode.SUB: {
            const { value: right, stack: s1 } = popNumber(state, instruction);
            const stateAfterPop1 = { ...state, operandStack: s1 };
            const { value: left, stack: s2 } = popNumber(stateAfterPop1, instruction);
            const stateAfterPop2 = { ...stateAfterPop1, operandStack: s2 };
            const { state: s3, address } = heapAlloc(stateAfterPop2, left - right);
            return {
                ...s3,
                operandStack: [...s3.operandStack, address],
                pc: s3.pc + 1,
                stepCount: s3.stepCount + 1,
            };
        }

        case Opcode.MUL: {
            const { value: right, stack: s1 } = popNumber(state, instruction);
            const stateAfterPop1 = { ...state, operandStack: s1 };
            const { value: left, stack: s2 } = popNumber(stateAfterPop1, instruction);
            const stateAfterPop2 = { ...stateAfterPop1, operandStack: s2 };
            const { state: s3, address } = heapAlloc(stateAfterPop2, left * right);
            return {
                ...s3,
                operandStack: [...s3.operandStack, address],
                pc: s3.pc + 1,
                stepCount: s3.stepCount + 1,
            };
        }

        case Opcode.DIV: {
            const { value: right, stack: s1 } = popNumber(state, instruction);
            if (right === 0) {
                throw divisionByZero(state.pc, state.stepCount, instruction);
            }
            const stateAfterPop1 = { ...state, operandStack: s1 };
            const { value: left, stack: s2 } = popNumber(stateAfterPop1, instruction);
            const stateAfterPop2 = { ...stateAfterPop1, operandStack: s2 };
            const { state: s3, address } = heapAlloc(stateAfterPop2, left / right);
            return {
                ...s3,
                operandStack: [...s3.operandStack, address],
                pc: s3.pc + 1,
                stepCount: s3.stepCount + 1,
            };
        }

        // ── Variables ──
        case Opcode.STORE: {
            if (state.operandStack.length === 0) {
                throw stackUnderflow(state.pc, state.stepCount, instruction);
            }
            const stack = [...state.operandStack];
            const address = stack.pop()!;
            const s1 = envBind(
                { ...state, operandStack: stack },
                state.currentEnvironment,
                instruction.name,
                address,
            );
            return {
                ...s1,
                pc: s1.pc + 1,
                stepCount: s1.stepCount + 1,
            };
        }

        case Opcode.LOAD: {
            const address = envLookup(state, state.currentEnvironment, instruction.name);
            if (address === null) {
                throw unboundVariable(state.pc, state.stepCount, instruction, instruction.name);
            }
            return {
                ...state,
                operandStack: [...state.operandStack, address],
                pc: state.pc + 1,
                stepCount: state.stepCount + 1,
            };
        }

        // ── Control Flow ──
        case Opcode.JUMP: {
            return {
                ...state,
                pc: instruction.target,
                stepCount: state.stepCount + 1,
            };
        }

        case Opcode.JUMP_IF_FALSE: {
            const { value, stack } = popValue(state, instruction);
            // Only false and 0 are falsy (no string/null types anymore)
            const isFalsy = value === false || value === 0;
            return {
                ...state,
                operandStack: stack,
                pc: isFalsy ? instruction.target : state.pc + 1,
                stepCount: state.stepCount + 1,
            };
        }

        // ── Functions ──
        case Opcode.MAKE_FUNCTION: {
            const fnValue: FunctionValue = {
                type: 'function',
                entry: instruction.entry,
                environment: state.currentEnvironment,
            };
            const { state: s1, address } = heapAlloc(state, fnValue);
            return {
                ...s1,
                operandStack: [...s1.operandStack, address],
                pc: s1.pc + 1,
                stepCount: s1.stepCount + 1,
            };
        }

        case Opcode.CALL: {
            if (state.operandStack.length === 0) {
                throw stackUnderflow(state.pc, state.stepCount, instruction);
            }

            // Pop function address
            let stack = [...state.operandStack];
            const fnAddr = stack.pop()!;
            const fnVal = heapRead(state, fnAddr, state.pc, state.stepCount, instruction);

            if (
                typeof fnVal !== 'object' ||
                fnVal === null ||
                !('type' in fnVal) ||
                (fnVal as FunctionValue).type !== 'function'
            ) {
                throw typeError(
                    state.pc,
                    state.stepCount,
                    instruction,
                    `CALL target is not a function`,
                );
            }

            const fn = fnVal as FunctionValue;

            // Pop args
            const args: HeapAddress[] = [];
            for (let i = 0; i < instruction.argCount; i++) {
                if (stack.length === 0) {
                    throw stackUnderflow(state.pc, state.stepCount, instruction);
                }
                args.push(stack.pop()!);
            }
            args.reverse();

            // Create new environment with parent = captured env
            let s1: VMState = { ...state, operandStack: stack };
            const envResult = createEnvironment(
                s1,
                fn.environment as EnvironmentAddress,
            );
            s1 = envResult.state;
            const newEnv = envResult.address;

            // Bind args
            for (let i = 0; i < args.length; i++) {
                s1 = envBind(s1, newEnv, `arg${i}`, args[i]!);
            }

            return {
                ...s1,
                callStack: [...s1.callStack, {
                    returnAddress: state.pc + 1,
                    environment: state.currentEnvironment,
                }],
                currentEnvironment: newEnv,
                pc: fn.entry,
                stepCount: s1.stepCount + 1,
            };
        }

        case Opcode.RET: {
            if (state.callStack.length === 0) {
                return {
                    ...state,
                    isRunning: false,
                    stepCount: state.stepCount + 1,
                };
            }
            const callStack = [...state.callStack];
            const frame = callStack.pop()!;
            return {
                ...state,
                callStack,
                pc: frame.returnAddress,
                currentEnvironment: frame.environment,
                stepCount: state.stepCount + 1,
            };
        }

        // ── Objects ──
        case Opcode.NEW_OBJECT: {
            const objValue: ObjectValue = { type: 'object', properties: {} };
            const { state: s1, address } = heapAlloc(state, objValue);
            return {
                ...s1,
                operandStack: [...s1.operandStack, address],
                pc: s1.pc + 1,
                stepCount: s1.stepCount + 1,
            };
        }

        case Opcode.SET_PROPERTY: {
            if (state.operandStack.length < 2) {
                throw stackUnderflow(state.pc, state.stepCount, instruction);
            }
            const stack = [...state.operandStack];
            const valueAddr = stack.pop()!;
            const objAddr = stack.pop()!;
            const objVal = heapRead(state, objAddr, state.pc, state.stepCount, instruction);
            if (
                typeof objVal !== 'object' ||
                objVal === null ||
                !('type' in objVal) ||
                (objVal as ObjectValue).type !== 'object'
            ) {
                throw invalidObjectAccess(
                    state.pc,
                    state.stepCount,
                    instruction,
                    `SET_PROPERTY target is not an object`,
                );
            }
            const obj = objVal as ObjectValue;
            const updatedObj: ObjectValue = {
                type: 'object',
                properties: { ...obj.properties, [instruction.name]: valueAddr },
            };
            return {
                ...state,
                operandStack: stack,
                heap: { ...state.heap, [objAddr]: updatedObj },
                pc: state.pc + 1,
                stepCount: state.stepCount + 1,
            };
        }

        case Opcode.GET_PROPERTY: {
            if (state.operandStack.length === 0) {
                throw stackUnderflow(state.pc, state.stepCount, instruction);
            }
            const stack = [...state.operandStack];
            const objAddr = stack.pop()!;
            const objVal = heapRead(state, objAddr, state.pc, state.stepCount, instruction);
            if (
                typeof objVal !== 'object' ||
                objVal === null ||
                !('type' in objVal) ||
                (objVal as ObjectValue).type !== 'object'
            ) {
                throw invalidObjectAccess(
                    state.pc,
                    state.stepCount,
                    instruction,
                    `GET_PROPERTY target is not an object`,
                );
            }
            const obj = objVal as ObjectValue;
            const propAddr = obj.properties[instruction.name];
            if (propAddr === undefined) {
                throw propertyNotFound(
                    state.pc,
                    state.stepCount,
                    instruction,
                    instruction.name,
                );
            }
            return {
                ...state,
                operandStack: [...stack, propAddr],
                pc: state.pc + 1,
                stepCount: state.stepCount + 1,
            };
        }

        // ── Lifecycle ──
        case Opcode.HALT: {
            return {
                ...state,
                isRunning: false,
                pc: state.pc + 1,
                stepCount: state.stepCount + 1,
            };
        }

        default: {
            throw invalidOpcode(state.pc, state.stepCount, instruction);
        }
    }
}
