import type { PackageParser } from '../../contracts/package-parser';
import { LocalPackageCandidate } from '../../domain/value-objects/local-package-candidate';
import { PackageName } from '../../domain/value-objects/package-name';
import { Version } from '../../domain/value-objects/version';

type TokenType =
  | 'identifier'
  | 'string'
  | 'number'
  | 'newline'
  | 'lparen'
  | 'rparen'
  | 'lbracket'
  | 'rbracket'
  | 'lbrace'
  | 'rbrace'
  | 'comma'
  | 'dot'
  | 'colon'
  | 'equal'
  | 'eof';

interface Token {
  type: TokenType;
  value?: string;
}

type Expression =
  | { type: 'string'; value: string }
  | { type: 'identifier'; name: string }
  | { type: 'attribute'; object: Expression; attribute: string }
  | { type: 'call'; callee: Expression; args: Expression[]; keywords: Array<{ name: string; value: Expression }> }
  | { type: 'list'; elements: Expression[] }
  | { type: 'tuple'; elements: Expression[] }
  | { type: 'dict'; entries: Array<{ key: Expression; value: Expression }> };

type Statement =
  | { type: 'assign'; target: string; value: Expression }
  | { type: 'expression'; expression: Expression };

function isIdentifierStart(character: string): boolean {
  return /[A-Za-z_]/.test(character);
}

function isIdentifierPart(character: string): boolean {
  return /[A-Za-z0-9_]/.test(character);
}

function readString(source: string, start: number): { value: string; nextIndex: number } {
  let index = start;
  while (/[rRuUbBfF]/.test(source[index] ?? '')) {
    index += 1;
  }

  const quote = source[index];
  if (quote !== '\'' && quote !== '"') {
    throw new Error(`Invalid Python string prefix near: ${source.slice(start, start + 20)}`);
  }

  const triple = source.slice(index, index + 3) === quote.repeat(3);
  const delimiterLength = triple ? 3 : 1;
  let cursor = index + delimiterLength;
  let result = '';

  while (cursor < source.length) {
    if (!triple && source[cursor] === '\\') {
      const escaped = source[cursor + 1];
      const mapped =
        escaped === 'n' ? '\n' :
        escaped === 't' ? '\t' :
        escaped === quote ? quote :
        escaped;
      result += mapped;
      cursor += 2;
      continue;
    }

    if (source.slice(cursor, cursor + delimiterLength) === quote.repeat(delimiterLength)) {
      return {
        value: result,
        nextIndex: cursor + delimiterLength,
      };
    }

    result += source[cursor];
    cursor += 1;
  }

  throw new Error('Unterminated Python string literal.');
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];

    if (character === ' ' || character === '\t' || character === '\r') {
      index += 1;
      continue;
    }

    if (character === '\n' || character === ';') {
      tokens.push({ type: 'newline' });
      index += 1;
      continue;
    }

    if (character === '#') {
      while (index < source.length && source[index] !== '\n') {
        index += 1;
      }
      continue;
    }

    if (isIdentifierStart(character)) {
      if ((source[index + 1] === '"' || source[index + 1] === '\'') && /[rRuUbBfF]/.test(character)) {
        const { value, nextIndex } = readString(source, index);
        tokens.push({ type: 'string', value });
        index = nextIndex;
        continue;
      }

      let end = index + 1;
      while (end < source.length && isIdentifierPart(source[end])) {
        end += 1;
      }
      tokens.push({ type: 'identifier', value: source.slice(index, end) });
      index = end;
      continue;
    }

    if (character === '"' || character === '\'') {
      const { value, nextIndex } = readString(source, index);
      tokens.push({ type: 'string', value });
      index = nextIndex;
      continue;
    }

    if (/\d/.test(character)) {
      let end = index + 1;
      while (end < source.length && /[\d.]/.test(source[end])) {
        end += 1;
      }
      tokens.push({ type: 'number', value: source.slice(index, end) });
      index = end;
      continue;
    }

    const singleCharacterTokens: Record<string, TokenType> = {
      '(': 'lparen',
      ')': 'rparen',
      '[': 'lbracket',
      ']': 'rbracket',
      '{': 'lbrace',
      '}': 'rbrace',
      ',': 'comma',
      '.': 'dot',
      ':': 'colon',
      '=': 'equal',
    };

    const tokenType = singleCharacterTokens[character];
    if (tokenType) {
      tokens.push({ type: tokenType });
      index += 1;
      continue;
    }

    throw new Error(`Unsupported Python syntax near "${source.slice(index, index + 20)}"`);
  }

  tokens.push({ type: 'eof' });
  return tokens;
}

class Parser {
  private readonly tokens: Token[];
  private position = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parseModule(): Statement[] {
    const statements: Statement[] = [];

    while (!this.is('eof')) {
      this.consumeNewlines();
      if (this.is('eof')) {
        break;
      }

      statements.push(this.parseStatement());
      this.consumeNewlines();
    }

    return statements;
  }

  private parseStatement(): Statement {
    if (this.is('identifier') && this.peek(1).type === 'equal') {
      const target = this.expect('identifier').value!;
      this.expect('equal');
      return {
        type: 'assign',
        target,
        value: this.parseExpression(),
      };
    }

    return {
      type: 'expression',
      expression: this.parseExpression(),
    };
  }

  private parseExpression(): Expression {
    let expression = this.parsePrimary();

    while (true) {
      if (this.match('dot')) {
        const attribute = this.expect('identifier').value!;
        expression = {
          type: 'attribute',
          object: expression,
          attribute,
        };
        continue;
      }

      if (this.match('lparen')) {
        const { args, keywords } = this.parseCallArguments();
        this.expect('rparen');
        expression = {
          type: 'call',
          callee: expression,
          args,
          keywords,
        };
        continue;
      }

      break;
    }

    return expression;
  }

  private parsePrimary(): Expression {
    if (this.is('string')) {
      return {
        type: 'string',
        value: this.expect('string').value!,
      };
    }

    if (this.is('identifier')) {
      return {
        type: 'identifier',
        name: this.expect('identifier').value!,
      };
    }

    if (this.match('lbracket')) {
      const elements = this.parseDelimitedExpressions('rbracket');
      this.expect('rbracket');
      return {
        type: 'list',
        elements,
      };
    }

    if (this.match('lbrace')) {
      const entries: Array<{ key: Expression; value: Expression }> = [];
      if (!this.is('rbrace')) {
        do {
          const key = this.parseExpression();
          this.expect('colon');
          const value = this.parseExpression();
          entries.push({ key, value });
        } while (this.match('comma') && !this.is('rbrace'));
      }
      this.expect('rbrace');
      return {
        type: 'dict',
        entries,
      };
    }

    if (this.match('lparen')) {
      const elements = this.parseDelimitedExpressions('rparen');
      this.expect('rparen');
      return {
        type: 'tuple',
        elements,
      };
    }

    throw new Error(`Unsupported Python expression near token "${this.current().type}".`);
  }

  private parseDelimitedExpressions(endToken: TokenType): Expression[] {
    const elements: Expression[] = [];

    this.consumeNewlines();
    if (this.is(endToken)) {
      return elements;
    }

    do {
      this.consumeNewlines();
      if (this.is(endToken)) {
        break;
      }
      elements.push(this.parseExpression());
      this.consumeNewlines();
    } while (this.match('comma'));

    return elements;
  }

  private parseCallArguments(): { args: Expression[]; keywords: Array<{ name: string; value: Expression }> } {
    const args: Expression[] = [];
    const keywords: Array<{ name: string; value: Expression }> = [];

    this.consumeNewlines();
    if (this.is('rparen')) {
      return { args, keywords };
    }

    do {
      this.consumeNewlines();
      if (this.is('rparen')) {
        break;
      }
      if (this.is('identifier') && this.peek(1).type === 'equal') {
        const name = this.expect('identifier').value!;
        this.expect('equal');
        keywords.push({ name, value: this.parseExpression() });
      } else {
        args.push(this.parseExpression());
      }
      this.consumeNewlines();
    } while (this.match('comma'));

    return { args, keywords };
  }

  private consumeNewlines(): void {
    while (this.match('newline')) {
      continue;
    }
  }

  private current(): Token {
    return this.tokens[this.position];
  }

  private peek(offset: number): Token {
    return this.tokens[this.position + offset] ?? { type: 'eof' };
  }

  private is(type: TokenType): boolean {
    return this.current().type === type;
  }

  private match(type: TokenType): boolean {
    if (this.is(type)) {
      this.position += 1;
      return true;
    }
    return false;
  }

  private expect(type: TokenType): Token {
    if (!this.is(type)) {
      throw new Error(`Expected token "${type}" but found "${this.current().type}".`);
    }
    const token = this.current();
    this.position += 1;
    return token;
  }
}

function resolveString(expression: Expression, variables: Map<string, string>): string | null {
  if (expression.type === 'string') {
    return expression.value.trim();
  }

  if (expression.type === 'identifier') {
    return variables.get(expression.name) ?? null;
  }

  return null;
}

function isSetupCallee(expression: Expression): boolean {
  if (expression.type === 'identifier') {
    return expression.name === 'setup';
  }

  if (expression.type === 'attribute') {
    return expression.attribute === 'setup';
  }

  return false;
}

function findSetupCall(expression: Expression): Extract<Expression, { type: 'call' }> | null {
  if (expression.type === 'call' && isSetupCallee(expression.callee)) {
    return expression;
  }

  if (expression.type === 'call') {
    return findSetupCall(expression.callee);
  }

  if (expression.type === 'attribute') {
    return findSetupCall(expression.object);
  }

  return null;
}

export class SetupPyParser implements PackageParser {
  parse(_filePath: string, content: string): LocalPackageCandidate {
    const parser = new Parser(tokenize(content));
    const statements = parser.parseModule();
    const variables = new Map<string, string>();

    for (const statement of statements) {
      if (statement.type === 'assign') {
        const resolvedValue = resolveString(statement.value, variables);
        if (resolvedValue !== null) {
          variables.set(statement.target, resolvedValue);
        }
      }
    }

    let setupCall: Extract<Expression, { type: 'call' }> | null = null;

    for (const statement of statements) {
      const expression = statement.type === 'assign' ? statement.value : statement.expression;
      const candidate = findSetupCall(expression);
      if (candidate) {
        setupCall = candidate;
        break;
      }
    }

    if (!setupCall) {
      throw new Error('setup.py does not contain a supported setup(...) call.');
    }

    const keywordMap = new Map(setupCall.keywords.map((keyword) => [keyword.name, keyword.value]));
    const packageName = keywordMap.has('name') ? resolveString(keywordMap.get('name')!, variables) : null;
    const version = keywordMap.has('version') ? resolveString(keywordMap.get('version')!, variables) : null;

    if (!packageName) {
      throw new Error('setup.py is missing a static "name" value in setup(...).');
    }

    if (!version) {
      throw new Error('setup.py is missing a static "version" value in setup(...).');
    }

    return new LocalPackageCandidate(new PackageName(packageName), new Version(version));
  }
}

export function parseSetupPy(content: string) {
  const parsed = new SetupPyParser().parse('setup.py', content);
  return {
    packageName: parsed.packageName.value,
    version: parsed.version?.value,
  };
}
