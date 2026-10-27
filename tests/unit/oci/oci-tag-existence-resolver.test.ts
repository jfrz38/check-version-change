import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompareVersionRequest } from '../../../src/application/compare-version-request';
import { resolveOciTagExistence } from '../../../src/application/oci-tag-existence-resolver';
import { CompareSource } from '../../../src/domain/value-objects/compare-source';
import { FileFormat } from '../../../src/domain/value-objects/file-format';

const ociClientMock = vi.hoisted(() => ({
  findManifest: vi.fn(),
}));

vi.mock('../../../src/oci/registry-client', () => ({
  ociRegistryClient: ociClientMock,
}));

vi.mock('@actions/github', () => ({
  context: { runId: 42 },
}));

function request(overrides: Partial<ConstructorParameters<typeof CompareVersionRequest>[0]> = {}) {
  return new CompareVersionRequest({
    cwd: process.cwd(),
    filePath: 'package.json',
    registry: 'auto',
    compareSource: CompareSource.fromInput('oci'),
    fileFormat: FileFormat.fromInput('auto'),
    allowMissingCompareFile: false,
    compareSemver: true,
    ociRepository: 'ghcr.io/example/plugin',
    ociTagPattern: 'v{version}',
    ...overrides,
  });
}

describe('resolveOciTagExistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the tag from the local version and returns an existing manifest', async () => {
    ociClientMock.findManifest.mockResolvedValue({ digest: 'sha256:abc' });

    const result = await resolveOciTagExistence(request(), '1.2.3');

    expect(ociClientMock.findManifest).toHaveBeenCalledWith(
      'ghcr.io/example/plugin',
      'v1.2.3',
      expect.objectContaining({ userAgent: 'check-version-change/42' }),
    );
    expect(result).toEqual({
      exists: true,
      manifestDigest: 'sha256:abc',
      reference: 'ghcr.io/example/plugin:v1.2.3',
    });
  });

  it('returns a missing result when the registry does not contain the tag', async () => {
    ociClientMock.findManifest.mockResolvedValue(null);

    await expect(resolveOciTagExistence(request({ ociTagPattern: '{version}' }), '1.2.3')).resolves.toEqual({
      exists: false,
      manifestDigest: '',
      reference: 'ghcr.io/example/plugin:1.2.3',
    });
  });

  it('requires the tag pattern to contain the version placeholder', async () => {
    await expect(resolveOciTagExistence(request({ ociTagPattern: 'latest' }), '1.2.3'))
      .rejects.toThrow('must contain "{version}"');
    expect(ociClientMock.findManifest).not.toHaveBeenCalled();
  });
});
