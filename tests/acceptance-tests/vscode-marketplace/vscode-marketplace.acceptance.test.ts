import { afterEach, describe, expect, it } from 'vitest';
import { createTemporaryProject, runActionWithInputs } from '../../helpers/action-test-harness';

const NETWORK_TIMEOUT_MS = 60000;

describe('vscode-marketplace acceptance', () => {
  let project: ReturnType<typeof createTemporaryProject> | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it('runs the full VS Code Marketplace flow from package.json', async () => {
    project = createTemporaryProject({
      'package.json': JSON.stringify({
        publisher: 'ms-python',
        name: 'python',
        version: '9999.0.0',
      }, null, 2),
    });

    const { result } = await runActionWithInputs({
      'compare-source': 'registry',
      'compare-semver': 'true',
      'file-path': project.filePath('package.json'),
      registry: 'vscode-marketplace',
    });

    expect(result.registryDetected).toBe('vscode-marketplace');
    expect(result.packageNameDetected).toBe('ms-python.python');
    expect(result.publishedVersion).not.toBe('');
    expect(result.changed).toBe(true);
    expect(result.isHigher).toBe(true);
  }, NETWORK_TIMEOUT_MS);
});
