import { afterEach, describe, expect, it } from 'vitest';
import { createTemporaryProject, runActionWithInputs } from '../../helpers/action-test-harness';

const NETWORK_TIMEOUT_MS = 60000;

describe('maven-central acceptance', () => {
  let project: ReturnType<typeof createTemporaryProject> | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it('runs the full Maven Central flow from pom.xml', async () => {
    project = createTemporaryProject({
      'pom.xml': `
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>junit</groupId>
  <artifactId>junit</artifactId>
  <version>999.0.0</version>
</project>
`,
    });

    const { result } = await runActionWithInputs({
      'compare-semver': 'true',
      'file-path': project.filePath('pom.xml'),
    });

    expect(result.registryDetected).toBe('maven-central');
    expect(result.packageNameDetected).toBe('junit:junit');
    expect(result.publishedVersion).not.toBe('');
    expect(result.changed).toBe(true);
    expect(result.isHigher).toBe(true);
  }, NETWORK_TIMEOUT_MS);

  it('runs the full Maven Central flow from build.gradle', async () => {
    project = createTemporaryProject({
      'build.gradle': `
group = projectGroup
version = releaseVersion
`,
      'gradle.properties': `
projectGroup=junit
releaseVersion=999.0.0
`,
      'settings.gradle': `
rootProject.name = "junit"
`,
    });

    const { result } = await runActionWithInputs({
      'compare-semver': 'true',
      'file-path': project.filePath('build.gradle'),
    });

    expect(result.registryDetected).toBe('maven-central');
    expect(result.packageNameDetected).toBe('junit:junit');
    expect(result.publishedVersion).not.toBe('');
    expect(result.changed).toBe(true);
    expect(result.isHigher).toBe(true);
  }, NETWORK_TIMEOUT_MS);
});
