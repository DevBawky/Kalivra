class FormulaError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'FormulaError';
        this.code = code;
    }
}

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const MULTI_CHAR_OPERATORS = ['===', '!==', '**', '>=', '<=', '==', '!=', '&&', '||'];
const SINGLE_CHAR_OPERATORS = new Set(['+', '-', '*', '/', '%', '>', '<', '!', '?', ':', '(', ')']);

function tokenize(source) {
    if (typeof source !== 'string' || source.trim() === '') {
        throw new FormulaError('EMPTY_FORMULA', 'Formula must be a non-empty string.');
    }

    const tokens = [];
    let index = 0;

    while (index < source.length) {
        const char = source[index];
        if (/\s/.test(char)) {
            index++;
            continue;
        }

        const remainder = source.slice(index);
        const numberMatch = remainder.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
        if (numberMatch) {
            tokens.push({ type: 'number', value: Number(numberMatch[0]), position: index });
            index += numberMatch[0].length;
            continue;
        }

        const identifierMatch = remainder.match(/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/);
        if (identifierMatch) {
            tokens.push({ type: 'identifier', value: identifierMatch[0], position: index });
            index += identifierMatch[0].length;
            continue;
        }

        const multiOperator = MULTI_CHAR_OPERATORS.find(operator => remainder.startsWith(operator));
        if (multiOperator) {
            tokens.push({ type: 'operator', value: multiOperator, position: index });
            index += multiOperator.length;
            continue;
        }

        if (SINGLE_CHAR_OPERATORS.has(char)) {
            tokens.push({ type: 'operator', value: char, position: index });
            index++;
            continue;
        }

        throw new FormulaError('UNSUPPORTED_TOKEN', `Unsupported token at position ${index}.`);
    }

    tokens.push({ type: 'eof', value: '', position: source.length });
    return tokens;
}

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.index = 0;
    }

    parse() {
        const expression = this.parseConditional();
        if (this.current().type !== 'eof') {
            throw this.syntaxError(`Unexpected token "${this.current().value}".`);
        }
        return expression;
    }

    current() {
        return this.tokens[this.index];
    }

    match(...operators) {
        const token = this.current();
        if (token.type === 'operator' && operators.includes(token.value)) {
            this.index++;
            return token.value;
        }
        return null;
    }

    expect(operator) {
        if (!this.match(operator)) {
            throw this.syntaxError(`Expected "${operator}".`);
        }
    }

    syntaxError(message) {
        return new FormulaError('INVALID_SYNTAX', `${message} Position ${this.current().position}.`);
    }

    parseConditional() {
        const test = this.parseLogicalOr();
        if (!this.match('?')) return test;
        const consequent = this.parseConditional();
        this.expect(':');
        const alternate = this.parseConditional();
        return { type: 'conditional', test, consequent, alternate };
    }

    parseLogicalOr() {
        return this.parseLeftAssociative(() => this.parseLogicalAnd(), ['||']);
    }

    parseLogicalAnd() {
        return this.parseLeftAssociative(() => this.parseEquality(), ['&&']);
    }

    parseEquality() {
        return this.parseLeftAssociative(() => this.parseComparison(), ['===', '!==', '==', '!=']);
    }

    parseComparison() {
        return this.parseLeftAssociative(() => this.parseAdditive(), ['>', '>=', '<', '<=']);
    }

    parseAdditive() {
        return this.parseLeftAssociative(() => this.parseMultiplicative(), ['+', '-']);
    }

    parseMultiplicative() {
        return this.parseLeftAssociative(() => this.parseExponent(), ['*', '/', '%']);
    }

    parseExponent() {
        const left = this.parseUnary();
        if (!this.match('**')) return left;
        return { type: 'binary', operator: '**', left, right: this.parseExponent() };
    }

    parseUnary() {
        const operator = this.match('+', '-', '!');
        if (operator) return { type: 'unary', operator, argument: this.parseUnary() };
        return this.parsePrimary();
    }

    parsePrimary() {
        const token = this.current();
        if (token.type === 'number') {
            this.index++;
            return { type: 'literal', value: token.value };
        }
        if (token.type === 'identifier') {
            this.index++;
            return { type: 'identifier', name: token.value };
        }
        if (this.match('(')) {
            const expression = this.parseConditional();
            this.expect(')');
            return expression;
        }
        throw this.syntaxError('Expected a number, identifier, or parenthesized expression.');
    }

    parseLeftAssociative(parseOperand, operators) {
        let expression = parseOperand();
        let operator = this.match(...operators);
        while (operator) {
            expression = { type: 'binary', operator, left: expression, right: parseOperand() };
            operator = this.match(...operators);
        }
        return expression;
    }
}

function resolveIdentifier(scope, name) {
    if (name === 'true') return true;
    if (name === 'false') return false;

    const segments = name.split('.');
    if (segments.some(segment => FORBIDDEN_SEGMENTS.has(segment))) {
        throw new FormulaError('FORBIDDEN_IDENTIFIER', `Identifier "${name}" is not allowed.`);
    }

    let value = scope;
    for (const segment of segments) {
        if (value === null || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, segment)) {
            throw new FormulaError('UNKNOWN_IDENTIFIER', `Unknown identifier "${name}".`);
        }
        value = value[segment];
    }

    if (typeof value !== 'number' && typeof value !== 'boolean') {
        throw new FormulaError('INVALID_IDENTIFIER_VALUE', `Identifier "${name}" must resolve to a number or boolean.`);
    }
    return value;
}

function evaluateNode(node, scope) {
    switch (node.type) {
        case 'literal': return node.value;
        case 'identifier': return resolveIdentifier(scope, node.name);
        case 'conditional': return evaluateNode(node.test, scope)
            ? evaluateNode(node.consequent, scope)
            : evaluateNode(node.alternate, scope);
        case 'unary': {
            const value = evaluateNode(node.argument, scope);
            if (node.operator === '+') return +value;
            if (node.operator === '-') return -value;
            return !value;
        }
        case 'binary': return evaluateBinary(node, scope);
        default: throw new FormulaError('INVALID_AST', 'Formula contains an invalid expression.');
    }
}

function evaluateBinary(node, scope) {
    const left = evaluateNode(node.left, scope);
    if (node.operator === '&&') return left && evaluateNode(node.right, scope);
    if (node.operator === '||') return left || evaluateNode(node.right, scope);
    const right = evaluateNode(node.right, scope);

    switch (node.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '%': return left % right;
        case '**': return left ** right;
        case '>': return left > right;
        case '>=': return left >= right;
        case '<': return left < right;
        case '<=': return left <= right;
        case '===':
        case '==': return left === right;
        case '!==':
        case '!=': return left !== right;
        default: throw new FormulaError('UNSUPPORTED_OPERATOR', `Operator "${node.operator}" is not supported.`);
    }
}

function compileFormula(formula) {
    const ast = new Parser(tokenize(formula)).parse();
    return scope => {
        if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
            throw new FormulaError('INVALID_SCOPE', 'Formula scope must be an object.');
        }
        const result = evaluateNode(ast, scope);
        if (typeof result !== 'number' || !Number.isFinite(result)) {
            throw new FormulaError('NON_FINITE_RESULT', 'Formula must produce a finite number.');
        }
        return result;
    };
}

function evaluateFormula(formula, scope) {
    return compileFormula(formula)(scope);
}

function validateFormula(formula, scope) {
    try {
        evaluateFormula(formula, scope);
        return { valid: true };
    } catch (error) {
        if (error instanceof FormulaError) {
            return { valid: false, code: error.code, error: error.message };
        }
        throw error;
    }
}

module.exports = { FormulaError, compileFormula, evaluateFormula, validateFormula };
