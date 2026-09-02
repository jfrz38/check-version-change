import { parse } from 'smol-toml';

export type TomlValue = unknown;

export interface TomlTable {
  [key: string]: TomlValue;
}

export function parseToml(content: string): TomlTable {
  const parsed = parse(content);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('TOML document must contain a table at its root.');
  }

  return parsed as TomlTable;
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
