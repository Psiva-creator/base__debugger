import { Opcode } from 'chronovm-core';
import type { IRInstruction } from 'chronovm-core';

/**
 * Minimal source-to-IR compiler for ChronoVM.
 *
 * Supported syntax (one statement per line):
 *   x = 2           → LOAD_CONST 2, STORE x
 *   c = a + b       → LOAD a, LOAD b, ADD, STORE c
 *   obj = {}        → NEW_OBJECT, STORE obj
 *   obj.a = x       → LOAD obj, LOAD x, SET_PROPERTY a
 *   obj.a = 5       → LOAD obj, LOAD_CONST 5, SET_PROPERTY a
 */

const OP_MAP: Record<string, IRInstruction['opcode']> = {
    '+': Opcode.ADD,
    '-': Opcode.SUB,
    '*': Opcode.MUL,
    '/': Opcode.DIV,
};

function isNumber(s: string): boolean {
    return /^-?\d+(\.\d+)?$/.test(s);
}

function isIdentifier(s: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s);
}

function emitValue(token: string): IRInstruction[] {
    if (isNumber(token)) {
        return [{ opcode: Opcode.LOAD_CONST, value: Number(token) }];
    }
    if (token === 'true') {
        return [{ opcode: Opcode.LOAD_CONST, value: true }];
    }
    if (token === 'false') {
        return [{ opcode: Opcode.LOAD_CONST, value: false }];
    }
    if (isIdentifier(token)) {
        return [{ opcode: Opcode.LOAD, name: token }];
    }
    throw new Error(`Unknown value: "${token}"`);
}

function compileLine(line: string, lineNum: number): IRInstruction[] {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return [];

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) {
        throw new Error(`Line ${lineNum}: Expected assignment (=), got: "${trimmed}"`);
    }

    const lhs = trimmed.substring(0, eqIdx).trim();
    const rhs = trimmed.substring(eqIdx + 1).trim();

    if (!lhs) {
        throw new Error(`Line ${lineNum}: Missing left-hand side`);
    }
    if (!rhs) {
        throw new Error(`Line ${lineNum}: Missing right-hand side`);
    }

    // ── Property assignment: obj.prop = value ──
    const dotIdx = lhs.indexOf('.');
    if (dotIdx !== -1) {
        const objName = lhs.substring(0, dotIdx).trim();
        const propName = lhs.substring(dotIdx + 1).trim();

        if (!isIdentifier(objName)) {
            throw new Error(`Line ${lineNum}: Invalid object name "${objName}"`);
        }
        if (!isIdentifier(propName)) {
            throw new Error(`Line ${lineNum}: Invalid property name "${propName}"`);
        }

        return [
            { opcode: Opcode.LOAD, name: objName },
            ...emitValue(rhs),
            { opcode: Opcode.SET_PROPERTY, name: propName },
        ];
    }

    // ── Simple assignment: name = ... ──
    if (!isIdentifier(lhs)) {
        throw new Error(`Line ${lineNum}: Invalid variable name "${lhs}"`);
    }

    // Object literal: obj = {}
    if (rhs === '{}') {
        return [
            { opcode: Opcode.NEW_OBJECT },
            { opcode: Opcode.STORE, name: lhs },
        ];
    }

    // Binary expression: c = a + b
    const binMatch = rhs.match(/^(\S+)\s*([+\-*/])\s*(\S+)$/);
    if (binMatch) {
        const [, left, op, right] = binMatch as [string, string, string, string];
        const opcode = OP_MAP[op];
        if (!opcode) {
            throw new Error(`Line ${lineNum}: Unknown operator "${op}"`);
        }
        return [
            ...emitValue(left),
            ...emitValue(right),
            { opcode } as IRInstruction,
            { opcode: Opcode.STORE, name: lhs },
        ];
    }

    // Simple value: x = 2, x = y
    return [
        ...emitValue(rhs),
        { opcode: Opcode.STORE, name: lhs },
    ];
}

export function compile(source: string): IRInstruction[] {
    const lines = source.split('\n');
    const instructions: IRInstruction[] = [];

    for (let i = 0; i < lines.length; i++) {
        instructions.push(...compileLine(lines[i]!, i + 1));
    }

    instructions.push({ opcode: Opcode.HALT });
    return instructions;
}
