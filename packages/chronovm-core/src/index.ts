// ─────────────────────────────────────────────
// ChronoVM Core — Public API
// ─────────────────────────────────────────────

// ── IR ──
export { Opcode } from './ir/instructions';
export type {
    IRInstruction,
    LoadConstInstruction,
    ArithmeticInstruction,
    UnaryInstruction,
    StoreInstruction,
    LoadInstruction,
    JumpInstruction,
    JumpIfFalseInstruction,
    JumpIfTrueInstruction,
    HaltInstruction,
    CallInstruction,
    RetInstruction,
    MakeFunctionInstruction,
    NewObjectInstruction,
    SetPropertyInstruction,
    GetPropertyInstruction,
    BuildClassInstruction,
    NewListInstruction,
    ListAppendInstruction,
    ListGetInstruction,
    ListSetInstruction,
    ListLenInstruction,
    StackInstruction,
    PrintInstruction,
} from './ir/instructions';

// ── VM ──
export { createInitialState } from './vm/state';
export type { VMState, StackFrame } from './vm/state';
export { heapAlloc, heapRead } from './vm/heap';
export type { HeapAddress, HeapValue, FunctionValue, ObjectValue, ListValue } from './vm/heap';
export { createEnvironment, envBind, envLookup } from './vm/environment';
export type { EnvironmentAddress, EnvironmentRecord } from './vm/environment';
export { step } from './vm/step';
export { runVM, createStepper } from './vm/vm';
export type { VMResult, VMOptions } from './vm/vm';
export { collectGarbage } from './vm/gc';

// ── Trace ──
export { createSnapshot } from './trace/snapshot';
export type { VMSnapshot } from './trace/snapshot';
export { createTrace, appendSnapshot, sealTrace } from './trace/trace';
export type { ExecutionTrace } from './trace/trace';

// ── Errors ──
export { VMError, VMErrorType } from './errors/vm-errors';
export type { VMErrorData } from './errors/vm-errors';
export {
    stackUnderflow,
    invalidOpcode,
    unboundVariable,
    divisionByZero,
    heapAccessViolation,
    pcOutOfBounds,
    typeError,
    invalidObjectAccess,
    propertyNotFound,
} from './errors/vm-errors';
