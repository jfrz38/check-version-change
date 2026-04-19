import { afterEach, describe, expect, it } from 'vitest';
import { createTemporaryProject, runActionWithInputs } from '../../helpers/action-test-harness';

const NETWORK_TIMEOUT_MS = 60000;

describe('cargo acceptance', () => {
  let project: ReturnType<typeof createTemporaryProject> | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it('runs the full crates.io flow from Cargo.toml', async () => {
    project = createTemporaryProject({
      'Cargo.toml': `
[package]
name = "serde"
version = "999.0.0"
`,
    });

    const { result } = await runActionWithInputs({
      'compare-semver': 'true',
      'file-path': project.filePath('Cargo.toml'),
    });

    expect(result.registryDetected).toBe('crates-io');
    expect(result.packageNameDetected).toBe('serde');
    expect(result.publishedVersion).not.toBe('');
    expect(result.changed).toBe(true);
    expect(result.isHigher).toBe(true);
  }, NETWORK_TIMEOUT_MS);
});
