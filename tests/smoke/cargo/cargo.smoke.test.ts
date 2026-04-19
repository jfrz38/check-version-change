import { describe, expect, it } from 'vitest';
import { runActionWithInputs } from '../../helpers/action-test-harness';
import { NETWORK_TIMEOUT_MS, useTemporaryProject } from '../../helpers/smoke-test-helpers';

describe('cargo smoke', () => {
  const project = useTemporaryProject();

  it('checks crates.io packages end to end', async () => {
    const tempProject = project.create({
      'Cargo.toml': `
[package]
name = "serde"
version = "999.0.0"
`,
    });

    const { outputs } = await runActionWithInputs({
      'compare-semver': 'true',
      'file-path': tempProject.filePath('Cargo.toml'),
    });

    expect(outputs['registry-detected']).toBe('crates-io');
    expect(outputs['package-name-detected']).toBe('serde');
    expect(outputs['published-version']).not.toBe('');
    expect(outputs.changed).toBe('true');
    expect(outputs['is-higher']).toBe('true');
  }, NETWORK_TIMEOUT_MS);
});
