import { afterEach, describe, expect, it } from 'vitest';
import { createTemporaryProject, runActionWithInputs } from '../../helpers/action-test-harness';

const NETWORK_TIMEOUT_MS = 60000;

describe('go acceptance', () => {
  let project: ReturnType<typeof createTemporaryProject> | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it('runs the full Go proxy flow from go.mod with a version pattern', async () => {
    project = createTemporaryProject({
      'go.mod': `
module github.com/gin-gonic/gin

// version = "999.0.0"
go 1.25
`,
    });

    const { result } = await runActionWithInputs({
      'compare-semver': 'true',
      'file-path': project.filePath('go.mod'),
      'version-pattern': 'version\\s*=\\s*"([^"]+)"',
    });

    expect(result.registryDetected).toBe('go-proxy');
    expect(result.packageNameDetected).toBe('github.com/gin-gonic/gin');
    expect(result.publishedVersion).not.toBe('');
    expect(result.changed).toBe(true);
    expect(result.isHigher).toBe(true);
  }, NETWORK_TIMEOUT_MS);
});
