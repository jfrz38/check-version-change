import { describe, expect, it } from 'vitest';
import { parsePyProjectToml } from '../../../src/ecosystems/pypi/pyproject';
import { parseSetupPy } from '../../../src/ecosystems/pypi/setup-py';

describe('pypi', () => {
  it('pyproject parser prefers [project] metadata', () => {
    const result = parsePyProjectToml(`
[project]
name = "demo-project"
version = "1.2.3"

[tool.poetry]
name = "ignored-name"
version = "9.9.9"
`);

    expect(result).toEqual({
      packageName: 'demo-project',
      version: '1.2.3',
    });
  });

  it('pyproject parser falls back to poetry metadata', () => {
    const result = parsePyProjectToml(`
[tool.poetry]
name = "poetry-demo"
version = "0.8.0"
`);

    expect(result).toEqual({
      packageName: 'poetry-demo',
      version: '0.8.0',
    });
  });

  it('setup.py parser resolves variables and setup arguments', () => {
    const result = parseSetupPy(`
PACKAGE_NAME = "sample-lib"
PACKAGE_VERSION = "2.4.6"

setup(
    name=PACKAGE_NAME,
    version=PACKAGE_VERSION,
)
`);

    expect(result).toEqual({
      packageName: 'sample-lib',
      version: '2.4.6',
    });
  });
});
