// ─────────────────────────────────────────────
// ChronoVM Core — Public API
// ─────────────────────────────────────────────

// ── IR ──
export { Opcode } from './ir/instructions.ts';
export type {
    IRInstruction,
    LoadConstInstruction,
    ArithmeticInstruction,
    StoreInstruction,
    LoadInstruction,
    JumpInstruction,
    JumpIfFalseInstruction,
    HaltInstruction,
    CallInstruction,
    RetInstruction,
    MakeFunctionInstruction,
    NewObjectInstruction,
    SetPropertyInstruction,
    GetPropertyInstruction,
} from './ir/instructions.ts';

// ── VM ──
export { createInitialState } from './vm/state.ts';
export type { VMState, StackFrame } from './vm/state.ts';
export { heapAlloc, heapRead } from './vm/heap.ts';
export type { HeapAddress, HeapValue, FunctionValue, ObjectValue } from './vm/heap.ts';
export { createEnvironment, envBind, envLookup } from './vm/environment.ts';
export type { EnvironmentAddress, EnvironmentRecord } from './vm/environment.ts';
export { step } from './vm/step.ts';
export { runVM, createStepper } from './vm/vm.ts';
export type { VMResult, VMOptions } from './vm/vm.ts';
export { collectGarbage } from './vm/gc.ts';

// ── Trace ──
export { createSnapshot } from './trace/snapshot.ts';
export type { VMSnapshot } from './trace/snapshot.ts';
export { createTrace, appendSnapshot, sealTrace } from './trace/trace.ts';
export type { ExecutionTrace } from './trace/trace.ts';

// ── Errors ──
export { VMError, VMErrorType } from './errors/vm-errors.ts';
export type { VMErrorData } from './errors/vm-errors.ts';
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
} from './errors/vm-errors.ts';
