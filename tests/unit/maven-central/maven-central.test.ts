import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parseGradleBuildFile } from '../../../src/ecosystems/maven-central/gradle';
import { parsePomXml } from '../../../src/ecosystems/maven-central/pom';
import { fetchMavenCentralPublishedVersion } from '../../../src/ecosystems/maven-central/registry';

describe('maven-central', () => {
  it('pom.xml parser resolves parent fallback and project properties', () => {
    const result = parsePomXml(`
<project>
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.example</groupId>
    <version>1.2.3</version>
  </parent>
  <artifactId>demo-lib</artifactId>
  <properties>
    <revision>\${parent.version}</revision>
  </properties>
  <version>\${revision}</version>
</project>
`);

    expect(result).toEqual({
      packageName: 'com.example:demo-lib',
      version: '1.2.3',
    });
  });

  it('gradle parser resolves values from gradle.properties and settings.gradle', async () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'check-version-change-'));
    try {
      fs.writeFileSync(path.join(tempDirectory, 'build.gradle'), 'group = projectGroup\nversion = releaseVersion\n');
      fs.writeFileSync(path.join(tempDirectory, 'gradle.properties'), 'projectGroup=com.example\nreleaseVersion=2.5.0\n');
      fs.writeFileSync(path.join(tempDirectory, 'settings.gradle'), 'rootProject.name = "gradle-lib"\n');

      const result = await parseGradleBuildFile(path.join(tempDirectory, 'build.gradle'));
      expect(result).toEqual({
        packageName: 'com.example:gradle-lib',
        version: '2.5.0',
      });
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('client extracts latest version from Maven metadata', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => `
        <metadata>
          <groupId>com.example</groupId>
          <artifactId>demo-lib</artifactId>
          <versioning><latest>3.1.4</latest></versioning>
        </metadata>
      `,
    })) as unknown as typeof fetch;

    const result = await fetchMavenCentralPublishedVersion('com.example:demo-lib', { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://repo1.maven.org/maven2/com/example/demo-lib/maven-metadata.xml',
      expect.objectContaining({
        headers: expect.objectContaining({ accept: 'application/xml' }),
      }),
    );
    expect(result.version).toBe('3.1.4');
  });
});
