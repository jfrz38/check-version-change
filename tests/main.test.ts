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
  parseLocalPackageContent: vi.fn(),
}));

const gitUtilsMock = vi.hoisted(() => ({
  listFilesAtGitRef: vi.fn(),
  readFileAtGitRef: vi.fn(),
  resolveCompareFilePathAtGitRef: vi.fn(),
  resolveGitCompareRef: vi.fn(),
}));

vi.mock('@actions/core', () => coreMock);
vi.mock('@actions/github', () => githubMock);
vi.mock('../src/ecosystems/ecosystem-registry', () => registryMock);
vi.mock('../src/utils/git', () => gitUtilsMock);

describe('main', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    registryMock.detectRegistryFromFile.mockReturnValue('npm');
    registryMock.parseLocalPackageFile.mockResolvedValue({
      packageName: { value: 'demo-package' },
      version: { value: '1.2.0' },
    });
    registryMock.parseLocalPackageContent.mockResolvedValue({
      packageName: { value: 'demo-package' },
      version: { value: '1.1.0' },
    });
    gitUtilsMock.resolveGitCompareRef.mockReturnValue('base-sha-123');
    gitUtilsMock.resolveCompareFilePathAtGitRef.mockImplementation((_cwd: string, filePath: string) => filePath);
    gitUtilsMock.readFileAtGitRef.mockResolvedValue('{"name":"demo-package","version":"1.1.0"}');

    coreMock.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        registry: 'auto',
        'compare-source': '',
        'file-path': 'package.json',
        'compare-file-path': '',
        'package-name': '',
        'compare-ref': '',
        'version-pattern': '',
        'compare-semver': 'true',
      };

      return inputs[name] ?? '';
    });
  });

  it('compares against the version from a git ref when compare-source=git-ref', async () => {
    const { run } = await import('../src/main');

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
        'version-pattern': '',
        'compare-semver': 'true',
      };

      return inputs[name] ?? '';
    });

    const { run } = await import('../src/main');

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
    expect(registryMock.parseLocalPackageContent).toHaveBeenCalledWith(
      expect.stringMatching(/packages[\\/]+shared[\\/]+package\.json$/),
      expect.any(String),
      undefined,
    );
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
        'version-pattern': '',
        'compare-semver': 'true',
      };

      return inputs[name] ?? '';
    });
    registryMock.ecosystemRegistry.fetchPublishedVersion.mockResolvedValue('1.1.9');

    const { run } = await import('../src/main');
    const result = await run();

    expect(registryMock.ecosystemRegistry.fetchPublishedVersion).toHaveBeenCalled();
    expect(gitUtilsMock.resolveCompareFilePathAtGitRef).not.toHaveBeenCalled();
    expect(result.comparisonSourceDetected).toBe('registry');
    expect(result.comparedVersion).toBe('1.1.9');
  });
});
