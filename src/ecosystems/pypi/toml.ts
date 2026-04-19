export type TomlValue = string | number | boolean | TomlValue[] | TomlTable;
export interface TomlTable {
  [key: string]: TomlValue;
}

function stripComments(line: string): string {
  let result = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (const character of line) {
    if (escaped) {
      result += character;
      escaped = false;
      continue;
    }

    if (character === '\\' && inDouble) {
      result += character;
      escaped = true;
      continue;
    }

    if (character === '"' && !inSingle) {
      inDouble = !inDouble;
      result += character;
      continue;
    }

    if (character === '\'' && !inDouble) {
      inSingle = !inSingle;
      result += character;
      continue;
    }

    if (character === '#' && !inSingle && !inDouble) {
      break;
    }

    result += character;
  }

  return result.trim();
}

function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (const character of input) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === '\\' && inDouble) {
      current += character;
      escaped = true;
      continue;
    }

    if (character === '"' && !inSingle) {
      inDouble = !inDouble;
      current += character;
      continue;
    }

    if (character === '\'' && !inDouble) {
      inSingle = !inSingle;
      current += character;
      continue;
    }

    if (!inSingle && !inDouble) {
      if (character === '[' || character === '{') {
        depth += 1;
      } else if (character === ']' || character === '}') {
        depth -= 1;
      } else if (character === separator && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }

    current += character;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function parseStringValue(input: string): string {
  if (input.length < 2) {
    throw new Error(`Invalid TOML string: ${input}`);
  }

  const quote = input[0];
  const body = input.slice(1, -1);

  if (quote === '\'') {
    return body;
  }

  return body
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function parseValue(rawValue: string): TomlValue {
  const value = rawValue.trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
    return parseStringValue(value);
  }

  if (value === 'true' || value === 'false') {
    return value === 'true';
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) {
      return [];
    }
    return splitTopLevel(inner, ',').map((entry) => parseValue(entry));
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  throw new Error(`Unsupported TOML value: ${value}`);
}

function ensureTable(root: TomlTable, pathParts: string[]): TomlTable {
  let current = root;

  for (const part of pathParts) {
    const existing = current[part];
    if (existing == null) {
      current[part] = {};
    } else if (typeof existing !== 'object' || Array.isArray(existing)) {
      throw new Error(`TOML key "${pathParts.join('.')}" conflicts with a non-table value.`);
    }

    current = current[part] as TomlTable;
  }

  return current;
}

export function parseToml(content: string): TomlTable {
  const root: TomlTable = {};
  let currentTable = root;

  const lines = content.split(/\r?\n/);
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const cleaned = stripComments(lines[lineNumber]);
    if (!cleaned) {
      continue;
    }

    if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
      if (cleaned.startsWith('[[')) {
        throw new Error('Array-of-table syntax is not supported by this action parser.');
      }

      const tableName = cleaned.slice(1, -1).trim();
      if (!tableName) {
        throw new Error(`Invalid TOML table declaration on line ${lineNumber + 1}.`);
      }

      currentTable = ensureTable(root, tableName.split('.').map((part) => part.trim()));
      continue;
    }

    const equalsIndex = cleaned.indexOf('=');
    if (equalsIndex <= 0) {
      throw new Error(`Invalid TOML assignment on line ${lineNumber + 1}.`);
    }

    const key = cleaned.slice(0, equalsIndex).trim();
    const rawValue = cleaned.slice(equalsIndex + 1).trim();
    if (!key) {
      throw new Error(`Invalid TOML key on line ${lineNumber + 1}.`);
    }

    currentTable[key] = parseValue(rawValue);
  }

  return root;
}

export function getTomlString(table: TomlTable, path: string[]): string | undefined {
  let current: TomlValue = table;

  for (const part of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current) || !(part in current)) {
      return undefined;
    }
    current = (current as TomlTable)[part];
  }

  return typeof current === 'string' && current.trim() ? current.trim() : undefined;
}
