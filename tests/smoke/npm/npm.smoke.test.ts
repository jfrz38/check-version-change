import { describe, expect, it } from 'vitest';
import { runActionWithInputs } from '../../helpers/action-test-harness';
import { NETWORK_TIMEOUT_MS, useTemporaryProject } from '../../helpers/smoke-test-helpers';

describe('npm smoke', () => {
  const project = useTemporaryProject();

  it('checks npm packages end to end', async () => {
    const tempProject = project.create({
      'package.json': JSON.stringify({
        name: 'react',
        version: '999.0.0',
      }, null, 2),
    });

    const { outputs } = await runActionWithInputs({
      'compare-source': 'registry',
      'compare-semver': 'true',
      'file-path': tempProject.filePath('package.json'),
    });

    expect(outputs['registry-detected']).toBe('npm');
    expect(outputs['package-name-detected']).toBe('react');
    expect(outputs['published-version']).not.toBe('');
    expect(outputs.changed).toBe('true');
    expect(outputs['is-higher']).toBe('true');
  }, NETWORK_TIMEOUT_MS);
});
