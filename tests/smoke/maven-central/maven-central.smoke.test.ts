import { describe, expect, it } from 'vitest';
import { runActionWithInputs } from '../../helpers/action-test-harness';
import { NETWORK_TIMEOUT_MS, useTemporaryProject } from '../../helpers/smoke-test-helpers';

describe('maven-central smoke', () => {
  const project = useTemporaryProject();

  it('checks Maven Central packages end to end', async () => {
    const tempProject = project.create({
      'pom.xml': `
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>junit</groupId>
  <artifactId>junit</artifactId>
  <version>999.0.0</version>
</project>
`,
    });

    const { outputs } = await runActionWithInputs({
      'compare-semver': 'true',
      'file-path': tempProject.filePath('pom.xml'),
    });

    expect(outputs['registry-detected']).toBe('maven-central');
    expect(outputs['package-name-detected']).toBe('junit:junit');
    expect(outputs['published-version']).not.toBe('');
    expect(outputs.changed).toBe('true');
    expect(outputs['is-higher']).toBe('true');
  }, NETWORK_TIMEOUT_MS);
});
