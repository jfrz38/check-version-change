import { afterEach, describe, expect, it } from 'vitest';
import { createTemporaryProject, runActionWithInputs } from '../../helpers/action-test-harness';

const NETWORK_TIMEOUT_MS = 60000;

describe('cargo acceptance', () => {
  let project: ReturnType<typeof createTemporaryProject> | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it('runs the full crates.io flow with a workspace-inherited version', async () => {
    project = createTemporaryProject({
      'Cargo.toml': `
[workspace]
members = ["crates/serde"]

[workspace.package]
version = "999.0.0"
`,
      'crates/serde/Cargo.toml': `
[package]
name = "serde"
version.workspace = true
`,
    });

    const { result } = await runActionWithInputs({
      'compare-source': 'registry',
      'compare-semver': 'true',
      'file-path': project.filePath('crates/serde/Cargo.toml'),
    });

    expect(result.registryDetected).toBe('crates-io');
    expect(result.packageNameDetected).toBe('serde');
    expect(result.publishedVersion).not.toBe('');
    expect(result.changed).toBe(true);
    expect(result.isHigher).toBe(true);
  }, NETWORK_TIMEOUT_MS);
});
