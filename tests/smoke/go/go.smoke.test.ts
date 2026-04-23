import { describe, expect, it } from 'vitest';
import { runActionWithInputs } from '../../helpers/action-test-harness';
import { NETWORK_TIMEOUT_MS, useTemporaryProject } from '../../helpers/smoke-test-helpers';

describe('go smoke', () => {
  const project = useTemporaryProject();

  it('checks Go modules end to end', async () => {
    const tempProject = project.create({
      'go.mod': `
module github.com/gin-gonic/gin

// version = "999.0.0"
go 1.25
`,
    });

    const { outputs } = await runActionWithInputs({
      'compare-source': 'registry',
      'compare-semver': 'true',
      'file-path': tempProject.filePath('go.mod'),
      'version-pattern': 'version\\s*=\\s*"([^"]+)"',
    });

    expect(outputs['registry-detected']).toBe('go-proxy');
    expect(outputs['package-name-detected']).toBe('github.com/gin-gonic/gin');
    expect(outputs['published-version']).not.toBe('');
    expect(outputs.changed).toBe('true');
    expect(outputs['is-higher']).toBe('true');
  }, NETWORK_TIMEOUT_MS);
});
