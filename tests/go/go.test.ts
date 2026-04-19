import { describe, expect, it, vi } from 'vitest';
import { parseGoMod } from '../../src/ecosystems/go/parser';
import { fetchGoProxyPublishedVersion } from '../../src/ecosystems/go/registry';

describe('go', () => {
  it('parser reads module path', () => {
    const result = parseGoMod(`
module github.com/example/demo

go 1.25
`);

    expect(result).toEqual({
      packageName: 'github.com/example/demo',
    });
  });

  it('proxy client extracts latest version', async () => {
    const fetchImpl = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          Version: 'v1.38.0',
        }),
      })) as unknown as typeof fetch;

    const result = await fetchGoProxyPublishedVersion('github.com/GoogleCloudPlatform/cloudsql-proxy', { fetchImpl });

    expect(result.version).toBe('v1.38.0');
  });
});
