import { describe, expect, it } from 'vitest';
import { runActionWithInputs } from '../../helpers/action-test-harness';
import { NETWORK_TIMEOUT_MS, useTemporaryProject } from '../../helpers/smoke-test-helpers';

describe('pypi smoke', () => {
  const project = useTemporaryProject();

  it('checks PyPI packages end to end', async () => {
    const tempProject = project.create({
      'pyproject.toml': `
[project]
name = "requests"
version = "999.0.0"
`,
    });

    const { outputs } = await runActionWithInputs({
      'compare-semver': 'true',
      'file-path': tempProject.filePath('pyproject.toml'),
    });

    expect(outputs['registry-detected']).toBe('pypi');
    expect(outputs['package-name-detected']).toBe('requests');
    expect(outputs['published-version']).not.toBe('');
    expect(outputs.changed).toBe('true');
    expect(outputs['is-higher']).toBe('true');
  }, NETWORK_TIMEOUT_MS);
});
