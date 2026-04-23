export function countCaptureGroups(pattern: string): number {
  let count = 0;
  let escaped = false;
  let inCharacterClass = false;

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }

    if (character === '[') {
      inCharacterClass = true;
      continue;
    }

    if (character === ']' && inCharacterClass) {
      inCharacterClass = false;
      continue;
    }

    if (inCharacterClass || character !== '(') {
      continue;
    }

    const next = pattern[index + 1];
    const nextTwo = pattern.slice(index + 1, index + 3);

    if (next !== '?') {
      count += 1;
      continue;
    }

    if (nextTwo === '?<') {
      count += 1;
    }
  }

  return count;
}

export function extractVersionFromPattern(content: string, pattern: string): string {
  if (countCaptureGroups(pattern) !== 1) {
    throw new Error('The "version-pattern" input must contain exactly one capture group.');
  }

  let expression: RegExp;
  try {
    expression = new RegExp(pattern, 'm');
  } catch (error) {
    throw new Error(`Invalid "version-pattern" regex: ${error instanceof Error ? error.message : String(error)}`);
  }

  const match = expression.exec(content);
  if (!match || typeof match[1] !== 'string' || match[1].trim() === '') {
    throw new Error('The provided "version-pattern" did not match the file contents.');
  }

  return match[1].trim();
}
