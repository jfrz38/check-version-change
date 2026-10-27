import { describe, expect, it, vi } from 'vitest';
import { DistributionOciRegistryClient } from '../../../src/oci/registry-client';

const DIGEST = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function response(status: number, headers: Record<string, string> = {}, body?: object): Response {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    statusText: status === 200 ? 'OK' : status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Not Found',
    headers,
  });
}

describe('DistributionOciRegistryClient', () => {
  it('returns the manifest digest when a public tag exists', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(200, {
      'docker-content-digest': DIGEST,
    }));

    const result = await new DistributionOciRegistryClient().findManifest(
      'ghcr.io/example/plugin',
      'v1.2.0',
      { fetchImpl },
    );

    expect(result).toEqual({ digest: DIGEST });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://ghcr.io/v2/example/plugin/manifests/v1.2.0',
      expect.objectContaining({ method: 'HEAD' }),
    );
  });

  it('returns null when the tag does not exist', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(404));

    const result = await new DistributionOciRegistryClient().findManifest(
      'ghcr.io/example/plugin',
      '1.2.0',
      { fetchImpl },
    );

    expect(result).toBeNull();
  });

  it('answers a Bearer challenge using OCI credentials', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(401, {
        'www-authenticate': 'Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:example/plugin:pull"',
      }))
      .mockResolvedValueOnce(response(200, {}, { token: 'registry-bearer-token' }))
      .mockResolvedValueOnce(response(200, { 'docker-content-digest': DIGEST }));

    const result = await new DistributionOciRegistryClient().findManifest(
      'ghcr.io/example/plugin',
      '1.2.0',
      {
        credentials: { username: 'octocat', token: 'github-token' },
        fetchImpl,
      },
    );

    expect(result).toEqual({ digest: DIGEST });
    expect(fetchImpl.mock.calls[1][0]).toBe(
      'https://ghcr.io/token?service=ghcr.io&scope=repository%3Aexample%2Fplugin%3Apull&client_id=check-version-change',
    );
    expect(fetchImpl.mock.calls[1][1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({
        authorization: `Basic ${Buffer.from('octocat:github-token').toString('base64')}`,
      }),
    }));
    expect(fetchImpl.mock.calls[2][1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer registry-bearer-token' }),
    }));
  });

  it('supports anonymous Bearer authentication for public packages', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(401, {
        'www-authenticate': 'Bearer realm="https://ghcr.io/token",service="ghcr.io",scope="repository:example/plugin:pull"',
      }))
      .mockResolvedValueOnce(response(200, {}, { access_token: 'anonymous-token' }))
      .mockResolvedValueOnce(response(404));

    const result = await new DistributionOciRegistryClient().findManifest(
      'ghcr.io/example/plugin',
      '1.2.0',
      { fetchImpl },
    );

    expect(result).toBeNull();
    expect((fetchImpl.mock.calls[1][1]?.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('does not treat denied access as a missing tag', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(403));

    await expect(new DistributionOciRegistryClient().findManifest(
      'ghcr.io/example/plugin',
      '1.2.0',
      { fetchImpl },
    )).rejects.toThrow('OCI registry denied access with status 403 Forbidden');
  });

  it('rejects a successful response without a manifest digest', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(200));

    await expect(new DistributionOciRegistryClient().findManifest(
      'ghcr.io/example/plugin',
      '1.2.0',
      { fetchImpl },
    )).rejects.toThrow('valid Docker-Content-Digest');
  });

  it('retries a transient registry failure once', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200, { 'docker-content-digest': DIGEST }));

    await expect(new DistributionOciRegistryClient().findManifest(
      'ghcr.io/example/plugin',
      '1.2.0',
      { fetchImpl },
    )).resolves.toEqual({ digest: DIGEST });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects an authentication challenge with an insecure realm', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(401, {
      'www-authenticate': 'Bearer realm="http://ghcr.io/token",service="ghcr.io"',
    }));

    await expect(new DistributionOciRegistryClient().findManifest(
      'ghcr.io/example/plugin',
      '1.2.0',
      { fetchImpl },
    )).rejects.toThrow('authentication realm must use HTTPS');
  });

  it('validates repository and tag inputs before making a request', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const client = new DistributionOciRegistryClient();

    await expect(client.findManifest('https://ghcr.io/example/plugin', '1.2.0', { fetchImpl }))
      .rejects.toThrow('without a scheme, tag, or digest');
    await expect(client.findManifest('ghcr.io/example/plugin', 'release+1.2.0', { fetchImpl }))
      .rejects.toThrow('Invalid OCI tag');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
