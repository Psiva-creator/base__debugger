// ─────────────────────────────────────────────
// ChronoVM IR Instruction Set
// ─────────────────────────────────────────────
// Every instruction is an immutable plain object.
// No methods. No behavior. Data only.
// ─────────────────────────────────────────────

/**
 * All supported opcodes in ChronoVM.
 * PRINT has been removed — core VM has no IO side effects.
 */
export const Opcode = {
    // ── Literals ──
    LOAD_CONST: 'LOAD_CONST',

    // ── Arithmetic ──
    ADD: 'ADD',
    SUB: 'SUB',
    MUL: 'MUL',
    DIV: 'DIV',

    // ── Variables ──
    STORE: 'STORE',
    LOAD: 'LOAD',

    // ── Control Flow ──
    JUMP: 'JUMP',
    JUMP_IF_FALSE: 'JUMP_IF_FALSE',

    // ── Lifecycle ──
    HALT: 'HALT',

    // ── Functions ──
    CALL: 'CALL',
    RET: 'RET',
    MAKE_FUNCTION: 'MAKE_FUNCTION',

    // ── Objects ──
    NEW_OBJECT: 'NEW_OBJECT',
    SET_PROPERTY: 'SET_PROPERTY',
    GET_PROPERTY: 'GET_PROPERTY',
} as const;

export type Opcode = (typeof Opcode)[keyof typeof Opcode];

// ─────────────────────────────────────────────
// Instruction types — discriminated union
// ─────────────────────────────────────────────

export type LoadConstInstruction = {
    readonly opcode: typeof Opcode.LOAD_CONST;
    readonly value: number | boolean;
};

export type ArithmeticInstruction = {
    readonly opcode:
    | typeof Opcode.ADD
    | typeof Opcode.SUB
    | typeof Opcode.MUL
    | typeof Opcode.DIV;
};

export type StoreInstruction = {
    readonly opcode: typeof Opcode.STORE;
    readonly name: string;
};

export type LoadInstruction = {
    readonly opcode: typeof Opcode.LOAD;
    readonly name: string;
};

export type JumpInstruction = {
    readonly opcode: typeof Opcode.JUMP;
    readonly target: number;
};

export type JumpIfFalseInstruction = {
    readonly opcode: typeof Opcode.JUMP_IF_FALSE;
    readonly target: number;
};

export type HaltInstruction = {
    readonly opcode: typeof Opcode.HALT;
};

export type CallInstruction = {
    readonly opcode: typeof Opcode.CALL;
    readonly argCount: number;
};

export type RetInstruction = {
    readonly opcode: typeof Opcode.RET;
};

export type MakeFunctionInstruction = {
    readonly opcode: typeof Opcode.MAKE_FUNCTION;
    readonly entry: number;
};

export type NewObjectInstruction = {
    readonly opcode: typeof Opcode.NEW_OBJECT;
};

export type SetPropertyInstruction = {
    readonly opcode: typeof Opcode.SET_PROPERTY;
    readonly name: string;
};

export type GetPropertyInstruction = {
    readonly opcode: typeof Opcode.GET_PROPERTY;
    readonly name: string;
};

/**
 * Union of all instruction types.
 * The step executor switches on `instruction.opcode`.
 */
export type IRInstruction =
    | LoadConstInstruction
    | ArithmeticInstruction
    | StoreInstruction
    | LoadInstruction
    | JumpInstruction
    | JumpIfFalseInstruction
    | HaltInstruction
    | CallInstruction
    | RetInstruction
    | MakeFunctionInstruction
    | NewObjectInstruction
    | SetPropertyInstruction
    | GetPropertyInstruction;
