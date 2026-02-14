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
    MOD: 'MOD',
    NEGATE: 'NEGATE',

    // ── Logic ──
    NOT: 'NOT',

    // ── Variables ──
    STORE: 'STORE',
    LOAD: 'LOAD',

    // ── Control Flow ──
    JUMP: 'JUMP',
    JUMP_IF_FALSE: 'JUMP_IF_FALSE',
    JUMP_IF_TRUE: 'JUMP_IF_TRUE',

    // ── Comparisons ──
    EQ: 'EQ',
    NEQ: 'NEQ',
    LT: 'LT',
    GT: 'GT',
    LTE: 'LTE',
    GTE: 'GTE',

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
    BUILD_CLASS: 'BUILD_CLASS',

    // ── Lists ──
    NEW_LIST: 'NEW_LIST',
    LIST_APPEND: 'LIST_APPEND',
    LIST_GET: 'LIST_GET',
    LIST_SET: 'LIST_SET',
    LIST_LEN: 'LIST_LEN',

    // ── Stack ──
    DUP: 'DUP',
    POP: 'POP',

    // ── IO ──
    PRINT: 'PRINT',
} as const;

export type Opcode = (typeof Opcode)[keyof typeof Opcode];

// ─────────────────────────────────────────────
// Instruction types — discriminated union
// ─────────────────────────────────────────────

export type LoadConstInstruction = {
    readonly opcode: typeof Opcode.LOAD_CONST;
    readonly value: number | boolean | string | null;
};

export type ArithmeticInstruction = {
    readonly opcode:
    | typeof Opcode.ADD
    | typeof Opcode.SUB
    | typeof Opcode.MUL
    | typeof Opcode.DIV
    | typeof Opcode.MOD
    | typeof Opcode.EQ
    | typeof Opcode.NEQ
    | typeof Opcode.LT
    | typeof Opcode.GT
    | typeof Opcode.LTE
    | typeof Opcode.GTE;
};

export type UnaryInstruction = {
    readonly opcode: typeof Opcode.NEGATE | typeof Opcode.NOT;
};

export type StackInstruction = {
    readonly opcode: typeof Opcode.DUP | typeof Opcode.POP;
};

export type PrintInstruction = {
    readonly opcode: typeof Opcode.PRINT;
};

export type BuildClassInstruction = {
    readonly opcode: typeof Opcode.BUILD_CLASS;
    readonly name: string;
};

export type ListLenInstruction = {
    readonly opcode: typeof Opcode.LIST_LEN;
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

export type JumpIfTrueInstruction = {
    readonly opcode: typeof Opcode.JUMP_IF_TRUE;
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

export type NewListInstruction = {
    readonly opcode: typeof Opcode.NEW_LIST;
};

export type ListAppendInstruction = {
    readonly opcode: typeof Opcode.LIST_APPEND;
};

export type ListGetInstruction = {
    readonly opcode: typeof Opcode.LIST_GET;
};

export type ListSetInstruction = {
    readonly opcode: typeof Opcode.LIST_SET;
};

/**
 * Union of all instruction types.
 * The step executor switches on `instruction.opcode`.
 */
export type IRInstruction =
    | LoadConstInstruction
    | ArithmeticInstruction
    | UnaryInstruction
    | StoreInstruction
    | LoadInstruction
    | JumpInstruction
    | JumpIfFalseInstruction
    | JumpIfTrueInstruction
    | HaltInstruction
    | CallInstruction
    | RetInstruction
    | MakeFunctionInstruction
    | NewObjectInstruction
    | SetPropertyInstruction
    | GetPropertyInstruction
    | BuildClassInstruction
    | NewListInstruction
    | ListAppendInstruction
    | ListGetInstruction
    | ListSetInstruction
    | ListLenInstruction
    | StackInstruction
    | PrintInstruction;
