import { beforeEach, describe, expect, it, vi } from 'vitest';

const coreMock = vi.hoisted(() => ({
  getInput: vi.fn(),
  setOutput: vi.fn(),
  warning: vi.fn(),
  setFailed: vi.fn(),
}));

const githubMock = vi.hoisted(() => ({
  context: {
    runId: 123,
    baseRef: 'main',
    payload: {
      pull_request: {
        base: {
          ref: 'main',
          sha: 'base-sha-123',
        },
      },
    },
  },
}));

const registryMock = vi.hoisted(() => ({
  ecosystemRegistry: {
    fetchPublishedVersion: vi.fn(),
  },
  EcosystemRegistry: class {},
  detectRegistryFromFile: vi.fn(),
  parseLocalPackageFile: vi.fn(),
  parseLocalPackageFileForRegistry: vi.fn(),
  parseLocalPackageContent: vi.fn(),
  parseLocalPackageContentForRegistry: vi.fn(),
}));

const gitUtilsMock = vi.hoisted(() => ({
  listFilesAtGitRef: vi.fn(),
  readFileAtGitRef: vi.fn(),
  resolveCompareFilePathAtGitRef: vi.fn(),
  resolveGitCompareRef: vi.fn(),
}));

const gitFileNotFoundErrorMock = vi.hoisted(() => ({
  GitFileNotFoundError: class GitFileNotFoundError extends Error {},
}));

const fsPromisesMock = vi.hoisted(() => ({
  readFile: vi.fn(),
}));

vi.mock('@actions/core', () => coreMock);
vi.mock('@actions/github', () => githubMock);
vi.mock('../../src/ecosystems/ecosystem-registry', () => registryMock);
vi.mock('../../src/utils/git', () => gitUtilsMock);
vi.mock('../../src/utils/errors/git-file-not-found-error', () => gitFileNotFoundErrorMock);
vi.mock('node:fs/promises', () => fsPromisesMock);

describe('main', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    registryMock.detectRegistryFromFile.mockReturnValue('npm');
    registryMock.parseLocalPackageFile.mockResolvedValue({
      packageName: { value: 'demo-package' },
      version: { value: '1.2.0' },
    });
    registryMock.parseLocalPackageFileForRegistry.mockResolvedValue({
      packageName: { value: 'demo-package' },
      version: { value: '1.2.0' },
    });
    registryMock.parseLocalPackageContent.mockResolvedValue({
      packageName: { value: 'demo-package' },
      version: { value: '1.1.0' },
    });
    registryMock.parseLocalPackageContentForRegistry.mockResolvedValue({
      packageName: { value: 'demo-package' },
      version: { value: '1.1.0' },
    });
    gitUtilsMock.resolveGitCompareRef.mockReturnValue('base-sha-123');
    gitUtilsMock.resolveCompareFilePathAtGitRef.mockImplementation((_cwd: string, filePath: string) => filePath);
    gitUtilsMock.readFileAtGitRef.mockResolvedValue('{"name":"demo-package","version":"1.1.0"}');
    fsPromisesMock.readFile.mockResolvedValue('{"generator-cli":{"version":"7.14.0"}}');

    coreMock.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        registry: 'auto',
        'compare-source': '',
        'file-path': 'package.json',
        'compare-file-path': '',
        'package-name': '',
        'compare-ref': '',
        'allow-missing-compare-file': 'false',
        'version-pattern': '',
        'compare-semver': 'true',
        'fail-on-unchanged': 'false',
        'fail-on-not-higher': 'false',
      };

      return inputs[name] ?? '';
    });
  });

  it('extracts raw versions from an arbitrary file and a git ref without selecting an ecosystem', async () => {
    coreMock.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        registry: 'auto',
        'compare-source': 'git-ref',
        'compare-ref': 'HEAD^',
        'file-format': 'raw',
        'file-path': 'wrapper/openapitools.json',
        'compare-file-path': '',
        'package-name': '',
        'allow-missing-compare-file': 'false',
        'version-pattern': '"version"\\s*:\\s*"([^"]+)"',
        'compare-semver': 'true',
        'fail-on-unchanged': 'false',
        'fail-on-not-higher': 'false',
      };
      return inputs[name] ?? '';
    });
    gitUtilsMock.resolveGitCompareRef.mockReturnValue('HEAD^');
    gitUtilsMock.readFileAtGitRef.mockResolvedValue('{"generator-cli":{"version":"7.13.0"}}');

    const { run } = await import('../../src/main');
    const result = await run();

    expect(result).toMatchObject({
      changed: true,
      localVersion: '7.14.0',
      comparedVersion: '7.13.0',
      publishedVersion: '7.13.0',
      isHigher: true,
      registryDetected: '',
      packageNameDetected: '',
      comparisonSourceDetected: 'git-ref',
      compareRefResolved: 'HEAD^',
      compareFilePathResolved: expect.stringMatching(/wrapper[\\/]openapitools\.json$/),
    });
    expect(fsPromisesMock.readFile).toHaveBeenCalledWith(
      expect.stringMatching(/wrapper[\\/]openapitools\.json$/),
      'utf8',
    );
    expect(gitUtilsMock.resolveGitCompareRef).toHaveBeenCalledWith('HEAD^', githubMock.context);
    expect(registryMock.detectRegistryFromFile).not.toHaveBeenCalled();
    expect(registryMock.parseLocalPackageFileForRegistry).not.toHaveBeenCalled();
    expect(registryMock.parseLocalPackageContentForRegistry).not.toHaveBeenCalled();
    expect(registryMock.ecosystemRegistry.fetchPublishedVersion).not.toHaveBeenCalled();
  });

  it('uses compare-file-path and an explicit package name in raw mode', async () => {
    coreMock.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        registry: 'auto',
        'compare-source': 'git-ref',
        'compare-ref': 'main',
        'file-format': 'raw',
        'file-path': 'wrapper/openapitools.json',
        'compare-file-path': 'config/generator.json',
        'package-name': 'openapi-generator',
        'allow-missing-compare-file': 'false',
        'version-pattern': '"version"\\s*:\\s*"([^"]+)"',
        'compare-semver': 'true',
        'fail-on-unchanged': 'false',
        'fail-on-not-higher': 'false',
      };
      return inputs[name] ?? '';
    });
    gitUtilsMock.resolveGitCompareRef.mockReturnValue('main');
    gitUtilsMock.readFileAtGitRef.mockResolvedValue('{"version":"7.13.0"}');

    const { run } = await import('../../src/main');
    const result = await run();

    expect(gitUtilsMock.resolveCompareFilePathAtGitRef).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/config[\\/]generator\.json$/),
      'main',
      true,
    );
    expect(gitUtilsMock.readFileAtGitRef).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/config[\\/]generator\.json$/),
      'main',
    );
    expect(result.packageNameDetected).toBe('openapi-generator');
    expect(result.compareFilePathResolved).toMatch(/config[\\/]generator\.json$/);
  });

  it('requires version-pattern in raw mode', async () => {
    coreMock.getInput.mockImplementation((name: string) => ({
      'compare-source': 'git-ref',
      'file-format': 'raw',
      'file-path': 'version.txt',
    })[name] ?? '');

    const { run } = await import('../../src/main');

    await expect(run()).rejects.toThrow('The "version-pattern" input is required when file-format is "raw".');
  });

  it('rejects an invalid regex in raw mode', async () => {
    coreMock.getInput.mockImplementation((name: string) => ({
      'compare-source': 'git-ref',
      'compare-ref': 'HEAD^',
      'file-format': 'raw',
      'file-path': 'version.txt',
      'version-pattern': '(',
    })[name] ?? '');

    const { run } = await import('../../src/main');

    await expect(run()).rejects.toThrow(/Invalid "version-pattern" regex/);
  });

  it('rejects raw patterns without exactly one capture group', async () => {
    coreMock.getInput.mockImplementation((name: string) => ({
      'compare-source': 'git-ref',
      'compare-ref': 'HEAD^',
      'file-format': 'raw',
      'file-path': 'version.txt',
      'version-pattern': 'version=[^\\s]+',
    })[name] ?? '');

    const { run } = await import('../../src/main');

    await expect(run()).rejects.toThrow(/exactly one capture group/i);
  });

  it('rejects registry comparison in raw mode', async () => {
    coreMock.getInput.mockImplementation((name: string) => ({
      'compare-source': 'registry',
      'file-format': 'raw',
      'file-path': 'version.txt',
      'version-pattern': 'version=(.+)',
    })[name] ?? '');

    const { run } = await import('../../src/main');

    await expect(run()).rejects.toThrow('file-format "raw" can only be used with compare-source "git-ref".');
    expect(registryMock.detectRegistryFromFile).not.toHaveBeenCalled();
    expect(registryMock.ecosystemRegistry.fetchPublishedVersion).not.toHaveBeenCalled();
  });

  it('rejects unsupported file-format values', async () => {
    coreMock.getInput.mockImplementation((name: string) => ({
      'file-format': 'json',
      'file-path': 'version.json',
    })[name] ?? '');

    const { run } = await import('../../src/main');

    await expect(run()).rejects.toThrow('Unsupported file-format "json". Expected "auto" or "raw".');
  });

  it('compares against the version from a git ref when compare-source is omitted', async () => {
    const { run } = await import('../../src/main');

    const result = await run();

    expect(gitUtilsMock.resolveGitCompareRef).toHaveBeenCalledWith('', githubMock.context);
    expect(gitUtilsMock.resolveCompareFilePathAtGitRef).toHaveBeenCalled();
    expect(gitUtilsMock.readFileAtGitRef).toHaveBeenCalled();
    expect(registryMock.ecosystemRegistry.fetchPublishedVersion).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      changed: true,
      localVersion: '1.2.0',
      comparedVersion: '1.1.0',
      publishedVersion: '1.1.0',
      comparisonSourceDetected: 'git-ref',
      compareRefResolved: 'base-sha-123',
      compareFilePathResolved: expect.stringMatching(/package\.json$/),
      registryDetected: '',
    });
    expect(coreMock.setOutput).toHaveBeenCalledWith('compared-version', '1.1.0');
    expect(coreMock.setOutput).toHaveBeenCalledWith('compare-ref-resolved', 'base-sha-123');
    expect(coreMock.setOutput).toHaveBeenCalledWith('compare-file-path-resolved', expect.stringMatching(/package\.json$/));
  });

  it('uses compare-file-path when provided', async () => {
    coreMock.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        registry: 'auto',
        'compare-source': 'git-ref',
        'file-path': 'package.json',
        'compare-file-path': 'packages/shared/package.json',
        'package-name': '',
        'compare-ref': 'origin/main',
        'allow-missing-compare-file': 'false',
        'version-pattern': '',
        'compare-semver': 'true',
        'fail-on-unchanged': 'false',
        'fail-on-not-higher': 'false',
      };

      return inputs[name] ?? '';
    });

    const { run } = await import('../../src/main');

    await run();

    expect(gitUtilsMock.resolveGitCompareRef).toHaveBeenCalledWith('origin/main', githubMock.context);
    expect(gitUtilsMock.readFileAtGitRef).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/packages[\\/]+shared[\\/]+package\.json$/),
      'base-sha-123',
    );
    expect(gitUtilsMock.resolveCompareFilePathAtGitRef).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/packages[\\/]+shared[\\/]+package\.json$/),
      'base-sha-123',
      true,
    );
    expect(registryMock.parseLocalPackageContentForRegistry).toHaveBeenCalledWith(
      'npm',
      expect.stringMatching(/packages[\\/]+shared[\\/]+package\.json$/),
      expect.any(String),
      undefined,
    );
  });

  it('treats a missing comparison file as an initial version when enabled', async () => {
    coreMock.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        registry: 'auto',
        'compare-source': 'git-ref',
        'file-path': 'package.json',
        'compare-file-path': '',
        'package-name': '',
        'compare-ref': 'main',
        'allow-missing-compare-file': 'true',
        'version-pattern': '',
        'compare-semver': 'true',
        'fail-on-unchanged': 'false',
        'fail-on-not-higher': 'false',
      };

      return inputs[name] ?? '';
    });
    gitUtilsMock.resolveCompareFilePathAtGitRef.mockRejectedValue(new gitFileNotFoundErrorMock.GitFileNotFoundError());

    const { run } = await import('../../src/main');
    const result = await run();

    expect(result).toMatchObject({
      changed: true,
      comparedVersion: '',
      publishedVersion: '',
      isHigher: false,
      compareRefResolved: 'base-sha-123',
      compareFilePathResolved: '',
    });
    expect(gitUtilsMock.readFileAtGitRef).not.toHaveBeenCalled();
  });

  it('still supports explicit registry comparison', async () => {
    coreMock.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        registry: 'auto',
        'compare-source': 'registry',
        'file-path': 'package.json',
        'compare-file-path': '',
        'package-name': '',
        'compare-ref': '',
        'allow-missing-compare-file': 'false',
        'version-pattern': '',
        'compare-semver': 'true',
        'fail-on-unchanged': 'false',
        'fail-on-not-higher': 'false',
      };

      return inputs[name] ?? '';
    });
    registryMock.ecosystemRegistry.fetchPublishedVersion.mockResolvedValue('1.1.9');

    const { run } = await import('../../src/main');
    const result = await run();

    expect(registryMock.ecosystemRegistry.fetchPublishedVersion).toHaveBeenCalled();
    expect(gitUtilsMock.resolveCompareFilePathAtGitRef).not.toHaveBeenCalled();
    expect(result.comparisonSourceDetected).toBe('registry');
    expect(result.comparedVersion).toBe('1.1.9');
  });

  it('supports explicit VS Code Marketplace registry comparison', async () => {
    coreMock.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        registry: 'vscode-marketplace',
        'compare-source': 'registry',
        'file-path': 'package.json',
        'compare-file-path': '',
        'package-name': '',
        'compare-ref': '',
        'allow-missing-compare-file': 'false',
        'version-pattern': '',
        'compare-semver': 'true',
        'fail-on-unchanged': 'false',
        'fail-on-not-higher': 'false',
      };

      return inputs[name] ?? '';
    });
    registryMock.parseLocalPackageFileForRegistry.mockResolvedValue({
      packageName: { value: 'example.demo-extension' },
      version: { value: '2.0.0' },
    });
    registryMock.ecosystemRegistry.fetchPublishedVersion.mockResolvedValue('1.9.0');

    const { run } = await import('../../src/main');
    const result = await run();

    expect(registryMock.parseLocalPackageFileForRegistry).toHaveBeenCalledWith('vscode-marketplace', expect.stringMatching(/package\.json$/), undefined);
    expect(registryMock.ecosystemRegistry.fetchPublishedVersion).toHaveBeenCalledWith(
      'vscode-marketplace',
      'example.demo-extension',
      expect.any(Object),
    );
    expect(result.packageNameDetected).toBe('example.demo-extension');
    expect(result.registryDetected).toBe('vscode-marketplace');
    expect(result.comparedVersion).toBe('1.9.0');
  });

  it('fails after setting outputs when fail-on-unchanged is enabled and versions match', async () => {
    registryMock.ecosystemRegistry.fetchPublishedVersion.mockResolvedValue('1.2.0');
    coreMock.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        registry: 'auto',
        'compare-source': 'registry',
        'file-path': 'package.json',
        'compare-file-path': '',
        'package-name': '',
        'compare-ref': '',
        'allow-missing-compare-file': 'false',
        'version-pattern': '',
        'compare-semver': 'true',
        'fail-on-unchanged': 'true',
        'fail-on-not-higher': 'false',
      };

      return inputs[name] ?? '';
    });

    const { run } = await import('../../src/main');

    await expect(run()).rejects.toThrow('Version 1.2.0 is unchanged from the compared version.');
    expect(coreMock.setOutput).toHaveBeenCalledWith('changed', 'false');
    expect(coreMock.setOutput).toHaveBeenCalledWith('local-version', '1.2.0');
    expect(coreMock.setOutput).toHaveBeenCalledWith('compared-version', '1.2.0');
  });

  it('fails after setting outputs when fail-on-not-higher is enabled and local version is not higher', async () => {
    registryMock.ecosystemRegistry.fetchPublishedVersion.mockResolvedValue('1.3.0');
    coreMock.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        registry: 'auto',
        'compare-source': 'registry',
        'file-path': 'package.json',
        'compare-file-path': '',
        'package-name': '',
        'compare-ref': '',
        'allow-missing-compare-file': 'false',
        'version-pattern': '',
        'compare-semver': 'true',
        'fail-on-unchanged': 'false',
        'fail-on-not-higher': 'true',
      };

      return inputs[name] ?? '';
    });

    const { run } = await import('../../src/main');

    await expect(run()).rejects.toThrow('Version 1.2.0 is not higher than compared version 1.3.0.');
    expect(coreMock.setOutput).toHaveBeenCalledWith('changed', 'true');
    expect(coreMock.setOutput).toHaveBeenCalledWith('is-higher', 'false');
    expect(coreMock.setOutput).toHaveBeenCalledWith('compared-version', '1.3.0');
  });

  it('does not fail on fail-on-not-higher when no compared version exists', async () => {
    registryMock.ecosystemRegistry.fetchPublishedVersion.mockResolvedValue('');
    coreMock.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        registry: 'auto',
        'compare-source': 'registry',
        'file-path': 'package.json',
        'compare-file-path': '',
        'package-name': '',
        'compare-ref': '',
        'allow-missing-compare-file': 'false',
        'version-pattern': '',
        'compare-semver': 'true',
        'fail-on-unchanged': 'false',
        'fail-on-not-higher': 'true',
      };

      return inputs[name] ?? '';
    });

    const { run } = await import('../../src/main');
    const result = await run();

    expect(result.changed).toBe(true);
    expect(result.comparedVersion).toBe('');
    expect(coreMock.setOutput).toHaveBeenCalledWith('compared-version', '');
  });
});
