import { afterEach, describe, expect, it } from 'vitest';
import { createTemporaryProject, runActionWithInputs } from '../helpers/action-test-harness';

const NETWORK_TIMEOUT_MS = 60000;

describe('smoke', () => {
  let project: ReturnType<typeof createTemporaryProject> | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it('checks npm packages end to end', async () => {
    project = createTemporaryProject({
      'package.json': JSON.stringify({
        name: 'react',
        version: '999.0.0',
      }, null, 2),
    });

    const { outputs } = await runActionWithInputs({
      'compare-semver': 'true',
      'file-path': project.filePath('package.json'),
    });

    expect(outputs['registry-detected']).toBe('npm');
    expect(outputs['package-name-detected']).toBe('react');
    expect(outputs['published-version']).not.toBe('');
    expect(outputs.changed).toBe('true');
    expect(outputs['is-higher']).toBe('true');
  }, NETWORK_TIMEOUT_MS);

  it('checks PyPI packages end to end', async () => {
    project = createTemporaryProject({
      'pyproject.toml': `
[project]
name = "requests"
version = "999.0.0"
`,
    });

    const { outputs } = await runActionWithInputs({
      'compare-semver': 'true',
      'file-path': project.filePath('pyproject.toml'),
    });

    expect(outputs['registry-detected']).toBe('pypi');
    expect(outputs['package-name-detected']).toBe('requests');
    expect(outputs['published-version']).not.toBe('');
    expect(outputs.changed).toBe('true');
    expect(outputs['is-higher']).toBe('true');
  }, NETWORK_TIMEOUT_MS);

  it('checks Maven Central packages end to end', async () => {
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

    const { outputs } = await runActionWithInputs({
      'compare-semver': 'true',
      'file-path': project.filePath('pom.xml'),
    });

    expect(outputs['registry-detected']).toBe('maven-central');
    expect(outputs['package-name-detected']).toBe('junit:junit');
    expect(outputs['published-version']).not.toBe('');
    expect(outputs.changed).toBe('true');
    expect(outputs['is-higher']).toBe('true');
  }, NETWORK_TIMEOUT_MS);

  it('checks crates.io packages end to end', async () => {
    project = createTemporaryProject({
      'Cargo.toml': `
[package]
name = "serde"
version = "999.0.0"
`,
    });

    const { outputs } = await runActionWithInputs({
      'compare-semver': 'true',
      'file-path': project.filePath('Cargo.toml'),
    });

    expect(outputs['registry-detected']).toBe('crates-io');
    expect(outputs['package-name-detected']).toBe('serde');
    expect(outputs['published-version']).not.toBe('');
    expect(outputs.changed).toBe('true');
    expect(outputs['is-higher']).toBe('true');
  }, NETWORK_TIMEOUT_MS);

  it('checks Go modules end to end', async () => {
    project = createTemporaryProject({
      'go.mod': `
module github.com/gin-gonic/gin

// version = "999.0.0"
go 1.25
`,
    });

    const { outputs } = await runActionWithInputs({
      'compare-semver': 'true',
      'file-path': project.filePath('go.mod'),
      'version-pattern': 'version\\s*=\\s*"([^"]+)"',
    });

    expect(outputs['registry-detected']).toBe('go-proxy');
    expect(outputs['package-name-detected']).toBe('github.com/gin-gonic/gin');
    expect(outputs['published-version']).not.toBe('');
    expect(outputs.changed).toBe('true');
    expect(outputs['is-higher']).toBe('true');
  }, NETWORK_TIMEOUT_MS);
});
