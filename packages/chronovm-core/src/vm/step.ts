// ─────────────────────────────────────────────
// ChronoVM Step Executor
// ─────────────────────────────────────────────
// Executes exactly ONE instruction.
// PURE function: (state) → new state.
// No mutation. No external reads. No randomness.
// ─────────────────────────────────────────────

import { Opcode } from '../ir/instructions';
import type { IRInstruction } from '../ir/instructions';
import type { VMState } from './state';
import type { HeapAddress, FunctionValue, ObjectValue, ListValue } from './heap';
import { heapAlloc, heapRead } from './heap';
import { createEnvironment, envBind, envLookup } from './environment';
import type { EnvironmentAddress } from './environment';
import {
    stackUnderflow,
    divisionByZero,
    unboundVariable,
    pcOutOfBounds,
    invalidOpcode,
    typeError,
    invalidObjectAccess,
    propertyNotFound,
} from '../errors/vm-errors';

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
        throw typeError(state.pc, state.stepCount, instruction, `Expected number on stack, got ${typeof heapValue}`);
    }
    return { value: heapValue, stack };
}

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

function formatValue(val: unknown): string {
    if (val === null) return 'None';
    if (val === true) return 'True';
    if (val === false) return 'False';
    if (typeof val === 'object' && val !== null && 'type' in val) {
        const typed = val as { type: string };
        if (typed.type === 'list') {
            return '[list]';
        }
        if (typed.type === 'object') {
            return '{object}';
        }
        if (typed.type === 'function') {
            return '<function>';
        }
    }
    return String(val);
}

export function step(state: VMState): VMState {
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

        // ── ADD (polymorphic: number+number or string+string) ──
        case Opcode.ADD: {
            const { value: right, address: _ra, stack: s1 } = popValue(state, instruction);
            const stateAfterPop1 = { ...state, operandStack: s1 };
            const { value: left, address: _la, stack: s2 } = popValue(stateAfterPop1, instruction);
            const stateAfterPop2 = { ...stateAfterPop1, operandStack: s2 };

            let result: number | string;
            if (typeof left === 'string' && typeof right === 'string') {
                result = left + right;
            } else if (typeof left === 'number' && typeof right === 'number') {
                result = left + right;
            } else {
                throw typeError(state.pc, state.stepCount, instruction, `Cannot add ${typeof left} and ${typeof right}`);
            }
            const { state: s3, address } = heapAlloc(stateAfterPop2, result);
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
            return { ...s3, operandStack: [...s3.operandStack, address], pc: s3.pc + 1, stepCount: s3.stepCount + 1 };
        }

        case Opcode.MUL: {
            const { value: right, stack: s1 } = popNumber(state, instruction);
            const stateAfterPop1 = { ...state, operandStack: s1 };
            const { value: left, stack: s2 } = popNumber(stateAfterPop1, instruction);
            const stateAfterPop2 = { ...stateAfterPop1, operandStack: s2 };
            const { state: s3, address } = heapAlloc(stateAfterPop2, left * right);
            return { ...s3, operandStack: [...s3.operandStack, address], pc: s3.pc + 1, stepCount: s3.stepCount + 1 };
        }

        case Opcode.DIV: {
            const { value: right, stack: s1 } = popNumber(state, instruction);
            if (right === 0) throw divisionByZero(state.pc, state.stepCount, instruction);
            const stateAfterPop1 = { ...state, operandStack: s1 };
            const { value: left, stack: s2 } = popNumber(stateAfterPop1, instruction);
            const stateAfterPop2 = { ...stateAfterPop1, operandStack: s2 };
            const { state: s3, address } = heapAlloc(stateAfterPop2, left / right);
            return { ...s3, operandStack: [...s3.operandStack, address], pc: s3.pc + 1, stepCount: s3.stepCount + 1 };
        }

        case Opcode.MOD: {
            const { value: right, stack: s1 } = popNumber(state, instruction);
            if (right === 0) throw divisionByZero(state.pc, state.stepCount, instruction);
            const stateAfterPop1 = { ...state, operandStack: s1 };
            const { value: left, stack: s2 } = popNumber(stateAfterPop1, instruction);
            const stateAfterPop2 = { ...stateAfterPop1, operandStack: s2 };
            const { state: s3, address } = heapAlloc(stateAfterPop2, left % right);
            return { ...s3, operandStack: [...s3.operandStack, address], pc: s3.pc + 1, stepCount: s3.stepCount + 1 };
        }

        case Opcode.NEGATE: {
            const { value, stack } = popNumber(state, instruction);
            const { state: s1, address } = heapAlloc({ ...state, operandStack: stack }, -value);
            return { ...s1, operandStack: [...s1.operandStack, address], pc: s1.pc + 1, stepCount: s1.stepCount + 1 };
        }

        case Opcode.NOT: {
            const { value, stack } = popValue(state, instruction);
            const isTruthy = value !== false && value !== 0 && value !== null && value !== '';
            const { state: s1, address } = heapAlloc({ ...state, operandStack: stack }, !isTruthy);
            return { ...s1, operandStack: [...s1.operandStack, address], pc: s1.pc + 1, stepCount: s1.stepCount + 1 };
        }

        // ── Comparisons ──
        case Opcode.EQ: {
            const { value: right, stack: s1 } = popValue(state, instruction);
            const { value: left, stack: s2 } = popValue({ ...state, operandStack: s1 }, instruction);
            const { state: s3, address } = heapAlloc({ ...state, operandStack: s2 }, left === right);
            return { ...s3, operandStack: [...s3.operandStack, address], pc: s3.pc + 1, stepCount: s3.stepCount + 1 };
        }
        case Opcode.NEQ: {
            const { value: right, stack: s1 } = popValue(state, instruction);
            const { value: left, stack: s2 } = popValue({ ...state, operandStack: s1 }, instruction);
            const { state: s3, address } = heapAlloc({ ...state, operandStack: s2 }, left !== right);
            return { ...s3, operandStack: [...s3.operandStack, address], pc: s3.pc + 1, stepCount: s3.stepCount + 1 };
        }
        case Opcode.LT: {
            const { value: right, stack: s1 } = popNumber(state, instruction);
            const { value: left, stack: s2 } = popNumber({ ...state, operandStack: s1 }, instruction);
            const { state: s3, address } = heapAlloc({ ...state, operandStack: s2 }, left < right);
            return { ...s3, operandStack: [...s3.operandStack, address], pc: s3.pc + 1, stepCount: s3.stepCount + 1 };
        }
        case Opcode.GT: {
            const { value: right, stack: s1 } = popNumber(state, instruction);
            const { value: left, stack: s2 } = popNumber({ ...state, operandStack: s1 }, instruction);
            const { state: s3, address } = heapAlloc({ ...state, operandStack: s2 }, left > right);
            return { ...s3, operandStack: [...s3.operandStack, address], pc: s3.pc + 1, stepCount: s3.stepCount + 1 };
        }
        case Opcode.LTE: {
            const { value: right, stack: s1 } = popNumber(state, instruction);
            const { value: left, stack: s2 } = popNumber({ ...state, operandStack: s1 }, instruction);
            const { state: s3, address } = heapAlloc({ ...state, operandStack: s2 }, left <= right);
            return { ...s3, operandStack: [...s3.operandStack, address], pc: s3.pc + 1, stepCount: s3.stepCount + 1 };
        }
        case Opcode.GTE: {
            const { value: right, stack: s1 } = popNumber(state, instruction);
            const { value: left, stack: s2 } = popNumber({ ...state, operandStack: s1 }, instruction);
            const { state: s3, address } = heapAlloc({ ...state, operandStack: s2 }, left >= right);
            return { ...s3, operandStack: [...s3.operandStack, address], pc: s3.pc + 1, stepCount: s3.stepCount + 1 };
        }

        // ── Variables ──
        case Opcode.STORE: {
            if (state.operandStack.length === 0) throw stackUnderflow(state.pc, state.stepCount, instruction);
            const stack = [...state.operandStack];
            const address = stack.pop()!;
            const s1 = envBind({ ...state, operandStack: stack }, state.currentEnvironment, instruction.name, address);
            return { ...s1, pc: s1.pc + 1, stepCount: s1.stepCount + 1 };
        }

        case Opcode.LOAD: {
            const address = envLookup(state, state.currentEnvironment, instruction.name);
            if (address === null) throw unboundVariable(state.pc, state.stepCount, instruction, instruction.name);
            return { ...state, operandStack: [...state.operandStack, address], pc: state.pc + 1, stepCount: state.stepCount + 1 };
        }

        // ── Control Flow ──
        case Opcode.JUMP: {
            return { ...state, pc: instruction.target, stepCount: state.stepCount + 1 };
        }

        case Opcode.JUMP_IF_FALSE: {
            const { value, stack } = popValue(state, instruction);
            const isFalsy = value === false || value === 0 || value === null || value === '';
            return { ...state, operandStack: stack, pc: isFalsy ? instruction.target : state.pc + 1, stepCount: state.stepCount + 1 };
        }

        case Opcode.JUMP_IF_TRUE: {
            const { value, stack } = popValue(state, instruction);
            const isTruthy = value !== false && value !== 0 && value !== null && value !== '';
            return { ...state, operandStack: stack, pc: isTruthy ? instruction.target : state.pc + 1, stepCount: state.stepCount + 1 };
        }

        // ── Stack ──
        case Opcode.DUP: {
            if (state.operandStack.length === 0) throw stackUnderflow(state.pc, state.stepCount, instruction);
            const top = state.operandStack[state.operandStack.length - 1]!;
            return { ...state, operandStack: [...state.operandStack, top], pc: state.pc + 1, stepCount: state.stepCount + 1 };
        }

        case Opcode.POP: {
            if (state.operandStack.length === 0) throw stackUnderflow(state.pc, state.stepCount, instruction);
            const stack = [...state.operandStack];
            stack.pop();
            return { ...state, operandStack: stack, pc: state.pc + 1, stepCount: state.stepCount + 1 };
        }

        // ── PRINT ──
        case Opcode.PRINT: {
            const { value, stack } = popValue(state, instruction);
            return {
                ...state,
                operandStack: stack,
                output: [...state.output, formatValue(value)],
                pc: state.pc + 1,
                stepCount: state.stepCount + 1,
            };
        }

        // ── Functions ──
        case Opcode.MAKE_FUNCTION: {
            const fnValue: FunctionValue = { type: 'function', entry: instruction.entry, environment: state.currentEnvironment };
            const { state: s1, address } = heapAlloc(state, fnValue);
            return { ...s1, operandStack: [...s1.operandStack, address], pc: s1.pc + 1, stepCount: s1.stepCount + 1 };
        }

        case Opcode.CALL: {
            if (state.operandStack.length === 0) throw stackUnderflow(state.pc, state.stepCount, instruction);
            let stack = [...state.operandStack];
            const fnAddr = stack.pop()!;
            const fnVal = heapRead(state, fnAddr, state.pc, state.stepCount, instruction);

            if (typeof fnVal !== 'object' || fnVal === null || !('type' in fnVal) || (fnVal as FunctionValue).type !== 'function') {
                throw typeError(state.pc, state.stepCount, instruction, `CALL target is not a function`);
            }
            const fn = fnVal as FunctionValue;
            const args: HeapAddress[] = [];
            for (let i = 0; i < instruction.argCount; i++) {
                if (stack.length === 0) throw stackUnderflow(state.pc, state.stepCount, instruction);
                args.push(stack.pop()!);
            }
            args.reverse();
            let s1: VMState = { ...state, operandStack: stack };
            const envResult = createEnvironment(s1, fn.environment as EnvironmentAddress);
            s1 = envResult.state;
            const newEnv = envResult.address;
            for (let i = 0; i < args.length; i++) {
                s1 = envBind(s1, newEnv, `arg${i}`, args[i]!);
            }
            return {
                ...s1,
                callStack: [...s1.callStack, { returnAddress: state.pc + 1, environment: state.currentEnvironment }],
                currentEnvironment: newEnv,
                pc: fn.entry,
                stepCount: s1.stepCount + 1,
            };
        }

        case Opcode.RET: {
            if (state.callStack.length === 0) {
                return { ...state, isRunning: false, stepCount: state.stepCount + 1 };
            }
            const callStack = [...state.callStack];
            const frame = callStack.pop()!;
            return { ...state, callStack, pc: frame.returnAddress, currentEnvironment: frame.environment, stepCount: state.stepCount + 1 };
        }

        // ── Objects ──
        case Opcode.NEW_OBJECT: {
            const objValue: ObjectValue = { type: 'object', properties: {} };
            const { state: s1, address } = heapAlloc(state, objValue);
            return { ...s1, operandStack: [...s1.operandStack, address], pc: s1.pc + 1, stepCount: s1.stepCount + 1 };
        }

        case Opcode.SET_PROPERTY: {
            if (state.operandStack.length < 2) throw stackUnderflow(state.pc, state.stepCount, instruction);
            const stack = [...state.operandStack];
            const valueAddr = stack.pop()!;
            const objAddr = stack.pop()!;
            const objVal = heapRead(state, objAddr, state.pc, state.stepCount, instruction);
            if (typeof objVal !== 'object' || objVal === null || !('type' in objVal) || (objVal as ObjectValue).type !== 'object') {
                throw invalidObjectAccess(state.pc, state.stepCount, instruction, `SET_PROPERTY target is not an object`);
            }
            const obj = objVal as ObjectValue;
            const updatedObj: ObjectValue = { type: 'object', properties: { ...obj.properties, [instruction.name]: valueAddr } };
            return { ...state, operandStack: stack, heap: { ...state.heap, [objAddr]: updatedObj }, pc: state.pc + 1, stepCount: state.stepCount + 1 };
        }

        case Opcode.GET_PROPERTY: {
            if (state.operandStack.length === 0) throw stackUnderflow(state.pc, state.stepCount, instruction);
            const stack = [...state.operandStack];
            const objAddr = stack.pop()!;
            const objVal = heapRead(state, objAddr, state.pc, state.stepCount, instruction);
            if (typeof objVal !== 'object' || objVal === null || !('type' in objVal) || (objVal as ObjectValue).type !== 'object') {
                throw invalidObjectAccess(state.pc, state.stepCount, instruction, `GET_PROPERTY target is not an object`);
            }
            const obj = objVal as ObjectValue;
            const propAddr = obj.properties[instruction.name];
            if (propAddr === undefined) throw propertyNotFound(state.pc, state.stepCount, instruction, instruction.name);
            return { ...state, operandStack: [...stack, propAddr], pc: state.pc + 1, stepCount: state.stepCount + 1 };
        }

        case Opcode.BUILD_CLASS: {
            // BUILD_CLASS pops a function (the class body/constructor) from the stack
            // and wraps it into an object { type: 'function', ... } with a class name marker
            // For our purposes, a class IS its constructor function — calling it creates an instance
            if (state.operandStack.length === 0) throw stackUnderflow(state.pc, state.stepCount, instruction);
            const stack = [...state.operandStack];
            const fnAddr = stack.pop()!;
            // Store the constructor function under the class name
            const s1 = envBind({ ...state, operandStack: stack }, state.currentEnvironment, instruction.name, fnAddr);
            return { ...s1, pc: s1.pc + 1, stepCount: s1.stepCount + 1 };
        }

        // ── Lists ──
        case Opcode.NEW_LIST: {
            const listValue: ListValue = { type: 'list', elements: [] };
            const { state: s1, address } = heapAlloc(state, listValue);
            return { ...s1, operandStack: [...s1.operandStack, address], pc: s1.pc + 1, stepCount: s1.stepCount + 1 };
        }

        case Opcode.LIST_APPEND: {
            if (state.operandStack.length < 2) throw stackUnderflow(state.pc, state.stepCount, instruction);
            const stack = [...state.operandStack];
            const valueAddr = stack.pop()!;
            const listAddr = stack.pop()!;
            const listVal = heapRead(state, listAddr, state.pc, state.stepCount, instruction);
            if (typeof listVal !== 'object' || listVal === null || !('type' in listVal) || (listVal as ListValue).type !== 'list') {
                throw typeError(state.pc, state.stepCount, instruction, `LIST_APPEND target is not a list`);
            }
            const list = listVal as ListValue;
            const updatedList: ListValue = { type: 'list', elements: [...list.elements, valueAddr] };
            return { ...state, operandStack: [...stack, listAddr], heap: { ...state.heap, [listAddr]: updatedList }, pc: state.pc + 1, stepCount: state.stepCount + 1 };
        }

        case Opcode.LIST_GET: {
            if (state.operandStack.length < 2) throw stackUnderflow(state.pc, state.stepCount, instruction);
            const stack = [...state.operandStack];
            const indexAddr = stack.pop()!;
            const listAddr = stack.pop()!;
            const listVal = heapRead(state, listAddr, state.pc, state.stepCount, instruction);
            if (typeof listVal !== 'object' || listVal === null || !('type' in listVal) || (listVal as ListValue).type !== 'list') {
                throw typeError(state.pc, state.stepCount, instruction, `LIST_GET target is not a list`);
            }
            const indexVal = heapRead(state, indexAddr, state.pc, state.stepCount, instruction);
            if (typeof indexVal !== 'number') throw typeError(state.pc, state.stepCount, instruction, `LIST_GET index must be a number`);
            const list = listVal as ListValue;
            if (indexVal < 0 || indexVal >= list.elements.length) {
                throw typeError(state.pc, state.stepCount, instruction, `LIST_GET index ${indexVal} out of bounds (length ${list.elements.length})`);
            }
            return { ...state, operandStack: [...stack, list.elements[indexVal]!], pc: state.pc + 1, stepCount: state.stepCount + 1 };
        }

        case Opcode.LIST_SET: {
            if (state.operandStack.length < 3) throw stackUnderflow(state.pc, state.stepCount, instruction);
            const stack = [...state.operandStack];
            const valueAddr = stack.pop()!;
            const indexAddr = stack.pop()!;
            const listAddr = stack.pop()!;
            const listVal = heapRead(state, listAddr, state.pc, state.stepCount, instruction);
            if (typeof listVal !== 'object' || listVal === null || !('type' in listVal) || (listVal as ListValue).type !== 'list') {
                throw typeError(state.pc, state.stepCount, instruction, `LIST_SET target is not a list`);
            }
            const indexVal = heapRead(state, indexAddr, state.pc, state.stepCount, instruction);
            if (typeof indexVal !== 'number') throw typeError(state.pc, state.stepCount, instruction, `LIST_SET index must be a number`);
            const list = listVal as ListValue;
            if (indexVal < 0 || indexVal >= list.elements.length) {
                throw typeError(state.pc, state.stepCount, instruction, `LIST_SET index ${indexVal} out of bounds (length ${list.elements.length})`);
            }
            const newElements = [...list.elements];
            newElements[indexVal] = valueAddr;
            const updatedList: ListValue = { type: 'list', elements: newElements };
            return { ...state, operandStack: stack, heap: { ...state.heap, [listAddr]: updatedList }, pc: state.pc + 1, stepCount: state.stepCount + 1 };
        }

        case Opcode.LIST_LEN: {
            if (state.operandStack.length === 0) throw stackUnderflow(state.pc, state.stepCount, instruction);
            const stack = [...state.operandStack];
            const listAddr = stack.pop()!;
            const listVal = heapRead(state, listAddr, state.pc, state.stepCount, instruction);
            if (typeof listVal !== 'object' || listVal === null || !('type' in listVal) || (listVal as ListValue).type !== 'list') {
                throw typeError(state.pc, state.stepCount, instruction, `LIST_LEN target is not a list`);
            }
            const list = listVal as ListValue;
            const { state: s1, address } = heapAlloc({ ...state, operandStack: stack }, list.elements.length);
            return { ...s1, operandStack: [...s1.operandStack, address], pc: s1.pc + 1, stepCount: s1.stepCount + 1 };
        }

        // ── Lifecycle ──
        case Opcode.HALT: {
            return { ...state, isRunning: false, pc: state.pc + 1, stepCount: state.stepCount + 1 };
        }

        default: {
            throw invalidOpcode(state.pc, state.stepCount, instruction);
        }
    }
}
