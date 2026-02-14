import { Opcode } from 'chronovm-core';
import type { IRInstruction } from 'chronovm-core';

/**
 * Advanced Python-to-IR Compiler for ChronoVM.
 *
 * Supports: variables, arithmetic, comparisons, strings, None, booleans,
 * unary operators, logical and/or/not, modulo, print(), len(), range(),
 * if/elif/else, while, for-in-range, def, return, lists, subscripts,
 * class, __init__, self, method calls.
 */

// ═══════════════════════════════════════════════
// LEXER
// ═══════════════════════════════════════════════

type Token = {
    type: 'NUMBER' | 'IDENTIFIER' | 'OPERATOR' | 'KEYWORD' | 'NEWLINE'
    | 'INDENT' | 'DEDENT' | 'STRING' | 'BOOLEAN' | 'EOF' | 'PUNCTUATION';
    value: string;
    line: number;
};

const KEYWORDS = new Set([
    'if', 'elif', 'else', 'while', 'for', 'in', 'def', 'return',
    'True', 'False', 'None', 'class', 'and', 'or', 'not', 'pass',
]);
const COMPARISONS = ['==', '!=', '<', '>', '<=', '>='];

class Lexer {
    private pos = 0;
    private line = 1;
    private indents = [0];
    constructor(private source: string) { }

    private peek(): string { return this.source[this.pos] || ''; }
    private advance(): string {
        const char = this.peek();
        this.pos++;
        if (char === '\n') this.line++;
        return char;
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];
        let bol = true;

        while (this.pos < this.source.length) {
            const char = this.peek();

            if (bol) {
                let indent = 0;
                while (this.peek() === ' ') { this.advance(); indent++; }
                if (this.peek() === '\n') { this.advance(); continue; }
                if (this.peek() === '#') { while (this.peek() !== '\n' && this.pos < this.source.length) this.advance(); continue; }

                const last = this.indents[this.indents.length - 1]!;
                if (indent > last) {
                    this.indents.push(indent);
                    tokens.push({ type: 'INDENT', value: '', line: this.line });
                } else {
                    while (indent < (this.indents[this.indents.length - 1] || 0)) {
                        this.indents.pop();
                        tokens.push({ type: 'DEDENT', value: '', line: this.line });
                    }
                }
                bol = false;
                continue;
            }

            if (char === ' ' || char === '\r') { this.advance(); continue; }

            if (char === '\n') {
                this.advance();
                tokens.push({ type: 'NEWLINE', value: '\n', line: this.line - 1 });
                bol = true;
                continue;
            }

            if (char === '#') {
                while (this.peek() !== '\n' && this.pos < this.source.length) this.advance();
                continue;
            }

            if (char === '"' || char === "'") {
                const quote = this.advance();
                let str = '';
                while (this.peek() !== quote && this.pos < this.source.length) {
                    if (this.peek() === '\\') {
                        this.advance();
                        const esc = this.advance();
                        if (esc === 'n') str += '\n';
                        else if (esc === 't') str += '\t';
                        else if (esc === '\\') str += '\\';
                        else if (esc === quote) str += quote;
                        else str += '\\' + esc;
                    } else {
                        str += this.advance();
                    }
                }
                this.advance();
                tokens.push({ type: 'STRING', value: str, line: this.line });
                continue;
            }

            if (/\d/.test(char)) {
                let num = '';
                while (/[\d.]/.test(this.peek())) num += this.advance();
                tokens.push({ type: 'NUMBER', value: num, line: this.line });
                continue;
            }

            if (/[a-zA-Z_]/.test(char)) {
                let id = '';
                while (/[a-zA-Z0-9_]/.test(this.peek())) id += this.advance();
                if (id === 'True' || id === 'False') {
                    tokens.push({ type: 'BOOLEAN', value: id, line: this.line });
                } else if (KEYWORDS.has(id)) {
                    tokens.push({ type: 'KEYWORD', value: id, line: this.line });
                } else {
                    tokens.push({ type: 'IDENTIFIER', value: id, line: this.line });
                }
                continue;
            }

            const next2 = this.source.substring(this.pos, this.pos + 2);
            if (COMPARISONS.includes(next2)) {
                this.advance(); this.advance();
                tokens.push({ type: 'OPERATOR', value: next2, line: this.line });
                continue;
            }

            if ('+-*/%=<>!'.includes(char)) {
                this.advance();
                tokens.push({ type: 'OPERATOR', value: char, line: this.line });
                continue;
            }

            if ('():,.{}[]'.includes(char)) {
                this.advance();
                tokens.push({ type: 'PUNCTUATION', value: char, line: this.line });
                continue;
            }

            throw new Error(`Line ${this.line}: Unexpected character: ${char}`);
        }

        while (this.indents.length > 1) {
            this.indents.pop();
            tokens.push({ type: 'DEDENT', value: '', line: this.line });
        }
        tokens.push({ type: 'EOF', value: '', line: this.line });
        return tokens;
    }
}

// ═══════════════════════════════════════════════
// PARSER / CODE GENERATOR
// ═══════════════════════════════════════════════

type ClassInfo = {
    initParamCount: number;   // excludes self
    methodNames: string[];
};

class Parser {
    private tokens: Token[];
    private pos = 0;
    private ir: IRInstruction[] = [];
    private sourceMap: number[] = [];
    private knownClasses = new Map<string, ClassInfo>();

    constructor(tokens: Token[]) { this.tokens = tokens; }

    private peek(): Token { return this.tokens[this.pos]!; }
    private advance(): Token { return this.tokens[this.pos++]!; }
    private check(type: Token['type'], value?: string): boolean {
        const t = this.peek();
        return t.type === type && (!value || t.value === value);
    }
    private consume(type: Token['type'], msg: string): Token {
        if (this.check(type)) return this.advance();
        throw new Error(`Line ${this.peek().line}: ${msg} (got ${this.peek().type} "${this.peek().value}")`);
    }
    private emit(instr: IRInstruction) {
        this.ir.push(instr);
        this.sourceMap.push(this.peek().line);
    }
    private currentOffset(): number { return this.ir.length; }

    compile(): { instructions: IRInstruction[]; sourceMap: number[] } {
        while (!this.check('EOF')) {
            this.statementOrNewline();
        }
        this.emit({ opcode: Opcode.HALT });
        return { instructions: this.ir, sourceMap: this.sourceMap };
    }

    // ────── Statements ──────

    private statementOrNewline() {
        while (this.check('NEWLINE')) this.advance();
        if (this.check('EOF') || this.check('DEDENT')) return;
        this.statement();
        while (this.check('NEWLINE')) this.advance();
    }

    private statement() {
        if (this.check('KEYWORD', 'if')) return this.ifStatement();
        if (this.check('KEYWORD', 'while')) return this.whileStatement();
        if (this.check('KEYWORD', 'for')) return this.forStatement();
        if (this.check('KEYWORD', 'def')) return this.defStatement();
        if (this.check('KEYWORD', 'class')) return this.classStatement();
        if (this.check('KEYWORD', 'pass')) { this.advance(); return; }
        if (this.check('KEYWORD', 'return')) return this.returnStatement();
        this.assignmentOrExpression();
    }

    private returnStatement() {
        this.advance();
        if (!this.check('NEWLINE') && !this.check('EOF') && !this.check('DEDENT')) {
            this.expression();
        } else {
            this.emit({ opcode: Opcode.LOAD_CONST, value: null });
        }
        this.emit({ opcode: Opcode.RET });
    }

    private block(): IRInstruction[] {
        this.consume('PUNCTUATION', 'Expected ":" after block head');
        while (this.check('NEWLINE')) this.advance();
        this.consume('INDENT', 'Expected indent at start of block');
        const oldIr = this.ir;
        this.ir = [];
        while (!this.check('DEDENT') && !this.check('EOF')) {
            this.statementOrNewline();
        }
        const blockIr = this.ir;
        this.ir = oldIr;
        if (this.check('DEDENT')) this.advance();
        return blockIr;
    }

    // ── if / elif / else ──
    private ifStatement() {
        this.advance();
        this.expression();
        const jumpFalse = this.currentOffset();
        this.emit({ opcode: Opcode.JUMP_IF_FALSE, target: -1 });
        const ifBody = this.block();
        ifBody.forEach(i => this.emit(i));
        const jumpEnd = this.currentOffset();
        this.emit({ opcode: Opcode.JUMP, target: -1 });
        (this.ir[jumpFalse] as any).target = this.currentOffset();

        while (this.check('KEYWORD', 'elif')) {
            this.advance();
            this.expression();
            const elifJumpFalse = this.currentOffset();
            this.emit({ opcode: Opcode.JUMP_IF_FALSE, target: -1 });
            const elifBody = this.block();
            elifBody.forEach(i => this.emit(i));
            const newJumpEnd = this.currentOffset();
            this.emit({ opcode: Opcode.JUMP, target: -1 });
            (this.ir[elifJumpFalse] as any).target = this.currentOffset();
        }

        if (this.check('KEYWORD', 'else')) {
            this.advance();
            const elseBody = this.block();
            elseBody.forEach(i => this.emit(i));
        }

        // Patch all remaining JUMP target:-1 to current offset
        for (let i = 0; i < this.ir.length; i++) {
            const instr = this.ir[i]!;
            if (instr.opcode === Opcode.JUMP && (instr as any).target === -1) {
                (instr as any).target = this.currentOffset();
            }
        }
    }

    // ── while ──
    private whileStatement() {
        const loopStart = this.currentOffset();
        this.advance();
        this.expression();
        const jumpFalse = this.currentOffset();
        this.emit({ opcode: Opcode.JUMP_IF_FALSE, target: -1 });
        const body = this.block();
        body.forEach(i => this.emit(i));
        this.emit({ opcode: Opcode.JUMP, target: loopStart });
        (this.ir[jumpFalse] as any).target = this.currentOffset();
    }

    // ── for x in range(n) ──
    private forStatement() {
        this.advance();
        const varName = this.consume('IDENTIFIER', 'Expected loop variable').value;
        this.consume('KEYWORD', 'Expected "in"');
        this.consume('IDENTIFIER', 'Expected "range"');
        this.consume('PUNCTUATION', 'Expected "("');

        this.expression();
        let hasStart = false;
        if (this.check('PUNCTUATION', ',')) {
            this.advance();
            hasStart = true;
            this.expression();
        }
        this.consume('PUNCTUATION', 'Expected ")"');

        if (hasStart) {
            this.emit({ opcode: Opcode.STORE, name: '__limit' });
            this.emit({ opcode: Opcode.STORE, name: varName });
        } else {
            this.emit({ opcode: Opcode.STORE, name: '__limit' });
            this.emit({ opcode: Opcode.LOAD_CONST, value: 0 });
            this.emit({ opcode: Opcode.STORE, name: varName });
        }

        const loopStart = this.currentOffset();
        this.emit({ opcode: Opcode.LOAD, name: varName });
        this.emit({ opcode: Opcode.LOAD, name: '__limit' });
        this.emit({ opcode: Opcode.LT });
        const jumpFalse = this.currentOffset();
        this.emit({ opcode: Opcode.JUMP_IF_FALSE, target: -1 });

        const body = this.block();
        body.forEach(i => this.emit(i));

        this.emit({ opcode: Opcode.LOAD, name: varName });
        this.emit({ opcode: Opcode.LOAD_CONST, value: 1 });
        this.emit({ opcode: Opcode.ADD });
        this.emit({ opcode: Opcode.STORE, name: varName });
        this.emit({ opcode: Opcode.JUMP, target: loopStart });
        (this.ir[jumpFalse] as any).target = this.currentOffset();
    }

    // ── def ──
    private defStatement() {
        this.advance();
        const name = this.consume('IDENTIFIER', 'Expected function name').value;
        this.consume('PUNCTUATION', 'Expected "("');
        const params: string[] = [];
        while (!this.check('PUNCTUATION', ')')) {
            params.push(this.consume('IDENTIFIER', 'Expected parameter name').value);
            if (this.check('PUNCTUATION', ',')) this.advance();
        }
        this.consume('PUNCTUATION', 'Expected ")"');

        const jumpOver = this.currentOffset();
        this.emit({ opcode: Opcode.JUMP, target: -1 });
        const entry = this.currentOffset();

        params.forEach((p, i) => {
            this.emit({ opcode: Opcode.LOAD, name: `arg${i}` });
            this.emit({ opcode: Opcode.STORE, name: p });
        });

        const body = this.block();
        body.forEach(i => this.emit(i));

        this.emit({ opcode: Opcode.LOAD_CONST, value: null });
        this.emit({ opcode: Opcode.RET });

        (this.ir[jumpOver] as any).target = this.currentOffset();
        this.emit({ opcode: Opcode.MAKE_FUNCTION, entry });
        this.emit({ opcode: Opcode.STORE, name });
    }

    // ── class ──
    //
    // Strategy:
    //   1. Parse all methods, collecting their param info and body IR
    //   2. Emit all method bodies (jumped over)
    //   3. Emit a constructor function that:
    //      a. Creates a new instance object
    //      b. Copies all non-__init__ methods onto the instance
    //      c. Calls __init__(instance, forwarded_args...)
    //      d. Returns the instance
    //   4. Store the constructor as ClassName
    //
    private classStatement() {
        this.advance(); // class
        const className = this.consume('IDENTIFIER', 'Expected class name').value;

        // Optional parent class — skip
        if (this.check('PUNCTUATION', '(')) {
            this.advance();
            while (!this.check('PUNCTUATION', ')')) this.advance();
            this.consume('PUNCTUATION', 'Expected ")"');
        }

        this.consume('PUNCTUATION', 'Expected ":"');
        while (this.check('NEWLINE')) this.advance();
        this.consume('INDENT', 'Expected indent');

        // ── Phase 1: Parse all methods ──
        type MethodDef = { name: string; params: string[]; bodyIr: IRInstruction[] };
        const methods: MethodDef[] = [];

        while (!this.check('DEDENT') && !this.check('EOF')) {
            while (this.check('NEWLINE')) this.advance();
            if (this.check('DEDENT') || this.check('EOF')) break;

            if (this.check('KEYWORD', 'def')) {
                this.advance();
                const methodName = this.consume('IDENTIFIER', 'Expected method name').value;
                this.consume('PUNCTUATION', 'Expected "("');
                const params: string[] = [];
                while (!this.check('PUNCTUATION', ')')) {
                    params.push(this.consume('IDENTIFIER', 'Expected parameter').value);
                    if (this.check('PUNCTUATION', ',')) this.advance();
                }
                this.consume('PUNCTUATION', 'Expected ")"');
                const bodyIr = this.block();
                methods.push({ name: methodName, params, bodyIr });
            } else if (this.check('KEYWORD', 'pass')) {
                this.advance();
                while (this.check('NEWLINE')) this.advance();
            } else {
                this.advance();
            }
        }
        if (this.check('DEDENT')) this.advance();

        // Record class info
        const initMethod = methods.find(m => m.name === '__init__');
        const initParamCount = initMethod ? initMethod.params.length - 1 : 0;
        this.knownClasses.set(className, {
            initParamCount,
            methodNames: methods.filter(m => m.name !== '__init__').map(m => m.name),
        });

        // ── Phase 2: Emit method bodies (jumped over) ──
        const jumpOverAll = this.currentOffset();
        this.emit({ opcode: Opcode.JUMP, target: -1 });

        // Compile each method body and record its entry point
        const methodEntries = new Map<string, number>();
        for (const method of methods) {
            const entry = this.currentOffset();
            methodEntries.set(method.name, entry);

            // Bind params: arg0 = self, arg1 = first param, etc.
            method.params.forEach((p, i) => {
                this.emit({ opcode: Opcode.LOAD, name: `arg${i}` });
                this.emit({ opcode: Opcode.STORE, name: p });
            });

            method.bodyIr.forEach(instr => this.emit(instr));

            // Implicit return None
            this.emit({ opcode: Opcode.LOAD_CONST, value: null });
            this.emit({ opcode: Opcode.RET });
        }

        // ── Phase 3: Emit constructor function ──
        const ctorEntry = this.currentOffset();

        // Create the instance object
        this.emit({ opcode: Opcode.NEW_OBJECT });
        this.emit({ opcode: Opcode.STORE, name: '__instance' });

        // Copy non-__init__ methods onto the instance
        for (const method of methods) {
            if (method.name === '__init__') continue;
            const entry = methodEntries.get(method.name)!;
            // obj on stack, then fn on stack, then SET_PROPERTY
            this.emit({ opcode: Opcode.LOAD, name: '__instance' });
            this.emit({ opcode: Opcode.MAKE_FUNCTION, entry });
            this.emit({ opcode: Opcode.SET_PROPERTY, name: method.name });
        }

        // Call __init__ if it exists
        if (initMethod) {
            const initEntry = methodEntries.get('__init__')!;
            // Push self (instance) as first arg
            this.emit({ opcode: Opcode.LOAD, name: '__instance' });
            // Forward constructor args: arg0..arg(N-1) → become __init__'s arg1..argN
            for (let i = 0; i < initParamCount; i++) {
                this.emit({ opcode: Opcode.LOAD, name: `arg${i}` });
            }
            // Push the __init__ function
            this.emit({ opcode: Opcode.MAKE_FUNCTION, entry: initEntry });
            this.emit({ opcode: Opcode.CALL, argCount: 1 + initParamCount });
            this.emit({ opcode: Opcode.POP }); // discard __init__ return
        }

        // Return the instance
        this.emit({ opcode: Opcode.LOAD, name: '__instance' });
        this.emit({ opcode: Opcode.RET });

        // ── Phase 4: After all bodies, create the constructor function ──
        (this.ir[jumpOverAll] as any).target = this.currentOffset();
        this.emit({ opcode: Opcode.MAKE_FUNCTION, entry: ctorEntry });
        this.emit({ opcode: Opcode.STORE, name: className });
    }

    // ────── Assignment or Expression Statement ──────

    private assignmentOrExpression() {
        const idToken = this.peek();

        if (idToken.type === 'IDENTIFIER') {
            this.advance();

            // x = expr
            if (this.check('OPERATOR', '=')) {
                this.advance();
                this.expression();
                this.emit({ opcode: Opcode.STORE, name: idToken.value });
                return;
            }

            // x.prop ...
            if (this.check('PUNCTUATION', '.')) {
                this.advance();
                const prop = this.consume('IDENTIFIER', 'Expected property name').value;

                if (this.check('PUNCTUATION', '(')) {
                    // Method call: obj.method(args)
                    this.advance();
                    if (prop === 'append') {
                        // Built-in list append
                        this.emit({ opcode: Opcode.LOAD, name: idToken.value });
                        this.expression();
                        this.emit({ opcode: Opcode.LIST_APPEND });
                        this.emit({ opcode: Opcode.POP }); // discard list ref
                        this.consume('PUNCTUATION', 'Expected ")"');
                    } else {
                        // General method call: obj.method(args)
                        // Stack layout: [self, arg1, arg2, ..., fn] → CALL(1+N)
                        this.emit({ opcode: Opcode.LOAD, name: idToken.value }); // push self
                        let argCount = 1; // self counts
                        while (!this.check('PUNCTUATION', ')')) {
                            this.expression();
                            argCount++;
                            if (this.check('PUNCTUATION', ',')) this.advance();
                        }
                        this.consume('PUNCTUATION', 'Expected ")"');
                        // Load the method function from the object
                        this.emit({ opcode: Opcode.LOAD, name: idToken.value });
                        this.emit({ opcode: Opcode.GET_PROPERTY, name: prop });
                        // Call with self + explicit args
                        this.emit({ opcode: Opcode.CALL, argCount });
                        this.emit({ opcode: Opcode.POP }); // discard return
                    }
                    return;
                }

                if (this.check('OPERATOR', '=')) {
                    // Property set: obj.prop = expr
                    this.advance();
                    this.emit({ opcode: Opcode.LOAD, name: idToken.value });
                    this.expression();
                    this.emit({ opcode: Opcode.SET_PROPERTY, name: prop });
                    return;
                }

                // Property get as statement
                this.emit({ opcode: Opcode.LOAD, name: idToken.value });
                this.emit({ opcode: Opcode.GET_PROPERTY, name: prop });
                return;
            }

            // x[i] = expr
            if (this.check('PUNCTUATION', '[')) {
                this.advance();
                this.emit({ opcode: Opcode.LOAD, name: idToken.value });
                this.expression();
                this.consume('PUNCTUATION', 'Expected "]"');

                if (this.check('OPERATOR', '=')) {
                    this.advance();
                    this.expression();
                    this.emit({ opcode: Opcode.LIST_SET });
                    return;
                }

                this.emit({ opcode: Opcode.LIST_GET });
                return;
            }

            // Put back and parse as expression
            this.pos--;
        }

        this.expression();
    }

    // ────── Expressions ──────

    private expression() {
        this.orExpr();
    }

    private orExpr() {
        this.andExpr();
        while (this.check('KEYWORD', 'or')) {
            this.advance();
            this.emit({ opcode: Opcode.DUP });
            const jumpTrue = this.currentOffset();
            this.emit({ opcode: Opcode.JUMP_IF_TRUE, target: -1 });
            this.emit({ opcode: Opcode.POP });
            this.andExpr();
            (this.ir[jumpTrue] as any).target = this.currentOffset();
        }
    }

    private andExpr() {
        this.notExpr();
        while (this.check('KEYWORD', 'and')) {
            this.advance();
            this.emit({ opcode: Opcode.DUP });
            const jumpFalse = this.currentOffset();
            this.emit({ opcode: Opcode.JUMP_IF_FALSE, target: -1 });
            this.emit({ opcode: Opcode.POP });
            this.notExpr();
            (this.ir[jumpFalse] as any).target = this.currentOffset();
        }
    }

    private notExpr(): void {
        if (this.check('KEYWORD', 'not')) {
            this.advance();
            this.notExpr();
            this.emit({ opcode: Opcode.NOT });
            return;
        }
        this.comparison();
    }

    private comparison() {
        this.arithmetic();
        while (this.check('OPERATOR') && COMPARISONS.includes(this.peek().value)) {
            const op = this.advance().value;
            this.arithmetic();
            switch (op) {
                case '==': this.emit({ opcode: Opcode.EQ }); break;
                case '!=': this.emit({ opcode: Opcode.NEQ }); break;
                case '<': this.emit({ opcode: Opcode.LT }); break;
                case '>': this.emit({ opcode: Opcode.GT }); break;
                case '<=': this.emit({ opcode: Opcode.LTE }); break;
                case '>=': this.emit({ opcode: Opcode.GTE }); break;
            }
        }
    }

    private arithmetic() {
        this.term();
        while (this.check('OPERATOR', '+') || this.check('OPERATOR', '-')) {
            const op = this.advance().value;
            this.term();
            this.emit({ opcode: op === '+' ? Opcode.ADD : Opcode.SUB });
        }
    }

    private term() {
        this.unary();
        while (this.check('OPERATOR', '*') || this.check('OPERATOR', '/') || this.check('OPERATOR', '%')) {
            const op = this.advance().value;
            this.unary();
            if (op === '*') this.emit({ opcode: Opcode.MUL });
            else if (op === '/') this.emit({ opcode: Opcode.DIV });
            else this.emit({ opcode: Opcode.MOD });
        }
    }

    private unary(): void {
        if (this.check('OPERATOR', '-')) {
            this.advance();
            this.unary();
            this.emit({ opcode: Opcode.NEGATE });
            return;
        }
        this.postfix();
    }

    private postfix() {
        this.primary();
        while (true) {
            if (this.check('PUNCTUATION', '.')) {
                this.advance();
                const prop = this.consume('IDENTIFIER', 'Expected property name').value;
                if (this.check('PUNCTUATION', '(')) {
                    // Method call in expression context: result = obj.method(args)
                    this.advance();
                    if (prop === 'append') {
                        this.expression();
                        this.emit({ opcode: Opcode.LIST_APPEND });
                        this.consume('PUNCTUATION', 'Expected ")"');
                    } else {
                        // Save obj ref, push self, push args, load method, CALL
                        this.emit({ opcode: Opcode.STORE, name: '__self_tmp' });
                        this.emit({ opcode: Opcode.LOAD, name: '__self_tmp' }); // self
                        let argCount = 1;
                        while (!this.check('PUNCTUATION', ')')) {
                            this.expression();
                            argCount++;
                            if (this.check('PUNCTUATION', ',')) this.advance();
                        }
                        this.consume('PUNCTUATION', 'Expected ")"');
                        this.emit({ opcode: Opcode.LOAD, name: '__self_tmp' });
                        this.emit({ opcode: Opcode.GET_PROPERTY, name: prop });
                        this.emit({ opcode: Opcode.CALL, argCount });
                    }
                } else {
                    this.emit({ opcode: Opcode.GET_PROPERTY, name: prop });
                }
            } else if (this.check('PUNCTUATION', '[')) {
                this.advance();
                this.expression();
                this.consume('PUNCTUATION', 'Expected "]"');
                this.emit({ opcode: Opcode.LIST_GET });
            } else if (this.check('PUNCTUATION', '(')) {
                this.advance();
                let argCount = 0;
                while (!this.check('PUNCTUATION', ')')) {
                    this.expression();
                    argCount++;
                    if (this.check('PUNCTUATION', ',')) this.advance();
                }
                this.consume('PUNCTUATION', 'Expected ")"');
                this.emit({ opcode: Opcode.CALL, argCount });
            } else {
                break;
            }
        }
    }

    private primary() {
        const t = this.advance();

        if (t.type === 'NUMBER') {
            this.emit({ opcode: Opcode.LOAD_CONST, value: Number(t.value) });
            return;
        }

        if (t.type === 'STRING') {
            this.emit({ opcode: Opcode.LOAD_CONST, value: t.value });
            return;
        }

        if (t.type === 'BOOLEAN') {
            this.emit({ opcode: Opcode.LOAD_CONST, value: t.value === 'True' });
            return;
        }

        if (t.type === 'KEYWORD' && t.value === 'None') {
            this.emit({ opcode: Opcode.LOAD_CONST, value: null });
            return;
        }

        if (t.type === 'IDENTIFIER') {
            if (this.check('PUNCTUATION', '(')) {
                this.advance();
                if (t.value === 'print') {
                    if (!this.check('PUNCTUATION', ')')) {
                        this.expression();
                        this.emit({ opcode: Opcode.PRINT });
                        while (this.check('PUNCTUATION', ',')) {
                            this.advance();
                            if (!this.check('PUNCTUATION', ')')) {
                                this.expression();
                                this.emit({ opcode: Opcode.PRINT });
                            }
                        }
                    }
                    this.consume('PUNCTUATION', 'Expected ")"');
                    this.emit({ opcode: Opcode.LOAD_CONST, value: null });
                    return;
                }

                if (t.value === 'len') {
                    this.expression();
                    this.consume('PUNCTUATION', 'Expected ")"');
                    this.emit({ opcode: Opcode.LIST_LEN });
                    return;
                }

                if (t.value === 'str' || t.value === 'int') {
                    this.expression();
                    this.consume('PUNCTUATION', 'Expected ")"');
                    return;
                }

                if (t.value === 'type') {
                    this.expression();
                    this.consume('PUNCTUATION', 'Expected ")"');
                    this.emit({ opcode: Opcode.POP });
                    this.emit({ opcode: Opcode.LOAD_CONST, value: '<type>' });
                    return;
                }

                if (t.value === 'range') {
                    this.expression();
                    let hasStart = false;
                    if (this.check('PUNCTUATION', ',')) {
                        this.advance();
                        hasStart = true;
                        this.expression();
                    }
                    this.consume('PUNCTUATION', 'Expected ")"');
                    if (!hasStart) { this.emit({ opcode: Opcode.POP }); }
                    else { this.emit({ opcode: Opcode.POP }); this.emit({ opcode: Opcode.POP }); }
                    this.emit({ opcode: Opcode.NEW_LIST });
                    return;
                }

                // Regular function call
                let argCount = 0;
                while (!this.check('PUNCTUATION', ')')) {
                    this.expression();
                    argCount++;
                    if (this.check('PUNCTUATION', ',')) this.advance();
                }
                this.consume('PUNCTUATION', 'Expected ")"');
                this.emit({ opcode: Opcode.LOAD, name: t.value });
                this.emit({ opcode: Opcode.CALL, argCount });
                return;
            }

            this.emit({ opcode: Opcode.LOAD, name: t.value });
            return;
        }

        if (t.type === 'PUNCTUATION' && t.value === '(') {
            this.expression();
            this.consume('PUNCTUATION', 'Expected ")"');
            return;
        }

        if (t.type === 'PUNCTUATION' && t.value === '[') {
            this.emit({ opcode: Opcode.NEW_LIST });
            while (!this.check('PUNCTUATION', ']')) {
                this.expression();
                this.emit({ opcode: Opcode.LIST_APPEND });
                if (this.check('PUNCTUATION', ',')) this.advance();
            }
            this.consume('PUNCTUATION', 'Expected "]"');
            return;
        }

        if (t.type === 'PUNCTUATION' && t.value === '{') {
            this.emit({ opcode: Opcode.NEW_OBJECT });
            if (!this.check('PUNCTUATION', '}')) {
                while (!this.check('PUNCTUATION', '}')) {
                    const key = this.advance();
                    this.consume('PUNCTUATION', 'Expected ":"');
                    this.emit({ opcode: Opcode.DUP });
                    this.expression();
                    const keyStr = key.type === 'STRING' ? key.value : key.value;
                    this.emit({ opcode: Opcode.SET_PROPERTY, name: keyStr });
                    if (this.check('PUNCTUATION', ',')) this.advance();
                }
            }
            this.consume('PUNCTUATION', 'Expected "}"');
            return;
        }

        throw new Error(`Line ${t.line}: Unexpected token: ${t.type} "${t.value}"`);
    }
}

export type CompileResult = {
    readonly instructions: IRInstruction[];
    readonly sourceMap: number[];
};

/**
 * Compile Python source to IR with source map.
 * Returns both the instruction array and a parallel sourceMap
 * where sourceMap[i] = source line number for instructions[i].
 */
export function compileWithSourceMap(source: string): CompileResult {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.compile();
}

/**
 * Backward-compatible compile: returns only instructions.
 */
export function compile(source: string): IRInstruction[] {
    return compileWithSourceMap(source).instructions;
}
