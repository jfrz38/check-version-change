import { afterEach, describe, expect, it } from 'vitest';
import { createTemporaryProject, runActionWithInputs } from '../../helpers/action-test-harness';

const NETWORK_TIMEOUT_MS = 60000;

describe('pypi acceptance', () => {
  let project: ReturnType<typeof createTemporaryProject> | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it('runs the full PyPI flow from pyproject.toml', async () => {
    project = createTemporaryProject({
      'pyproject.toml': `
[project]
name = "requests"
version = "999.0.0"
`,
    });

    const { result } = await runActionWithInputs({
      'compare-source': 'registry',
      'compare-semver': 'true',
      'file-path': project.filePath('pyproject.toml'),
    });

    expect(result.registryDetected).toBe('pypi');
    expect(result.packageNameDetected).toBe('requests');
    expect(result.publishedVersion).not.toBe('');
    expect(result.changed).toBe(true);
    expect(result.isHigher).toBe(true);
  }, NETWORK_TIMEOUT_MS);

  it('runs the full PyPI flow from setup.py', async () => {
    project = createTemporaryProject({
      'setup.py': `
PACKAGE_NAME = "requests"
PACKAGE_VERSION = "999.0.0"

setup(
    name=PACKAGE_NAME,
    version=PACKAGE_VERSION,
)
`,
    });

    const { result } = await runActionWithInputs({
      'compare-source': 'registry',
      'compare-semver': 'true',
      'file-path': project.filePath('setup.py'),
    });

    expect(result.registryDetected).toBe('pypi');
    expect(result.packageNameDetected).toBe('requests');
    expect(result.publishedVersion).not.toBe('');
    expect(result.changed).toBe(true);
    expect(result.isHigher).toBe(true);
  }, NETWORK_TIMEOUT_MS);
});
