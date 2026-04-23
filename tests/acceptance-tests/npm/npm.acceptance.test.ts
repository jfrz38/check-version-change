import { afterEach, describe, expect, it } from 'vitest';
import { createTemporaryProject, runActionWithInputs } from '../../helpers/action-test-harness';

const NETWORK_TIMEOUT_MS = 60000;

describe('npm acceptance', () => {
  let project: ReturnType<typeof createTemporaryProject> | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it('runs the full npm flow from package.json', async () => {
    project = createTemporaryProject({
      'package.json': JSON.stringify({
        name: 'react',
        version: '999.0.0',
      }, null, 2),
    });

    const { result } = await runActionWithInputs({
      'compare-source': 'registry',
      'compare-semver': 'true',
      'file-path': project.filePath('package.json'),
    });

    expect(result.registryDetected).toBe('npm');
    expect(result.packageNameDetected).toBe('react');
    expect(result.publishedVersion).not.toBe('');
    expect(result.changed).toBe(true);
    expect(result.isHigher).toBe(true);
  }, NETWORK_TIMEOUT_MS);
});
