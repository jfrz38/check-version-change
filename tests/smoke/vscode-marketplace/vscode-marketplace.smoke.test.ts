import { describe, expect, it } from 'vitest';
import { runActionWithInputs } from '../../helpers/action-test-harness';
import { NETWORK_TIMEOUT_MS, useTemporaryProject } from '../../helpers/smoke-test-helpers';

describe('vscode-marketplace smoke', () => {
  const project = useTemporaryProject();

  it('checks VS Code Marketplace extensions end to end', async () => {
    const tempProject = project.create({
      'package.json': JSON.stringify({
        publisher: 'ms-python',
        name: 'python',
        version: '9999.0.0',
      }, null, 2),
    });

    const { outputs } = await runActionWithInputs({
      'compare-source': 'registry',
      'compare-semver': 'true',
      'file-path': tempProject.filePath('package.json'),
      registry: 'vscode-marketplace',
    });

    expect(outputs['registry-detected']).toBe('vscode-marketplace');
    expect(outputs['package-name-detected']).toBe('ms-python.python');
    expect(outputs['published-version']).not.toBe('');
    expect(outputs.changed).toBe('true');
    expect(outputs['is-higher']).toBe('true');
  }, NETWORK_TIMEOUT_MS);
});
