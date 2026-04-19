import { describe, expect, it, vi } from 'vitest';
import { fetchNpmPublishedVersion } from '../../../src/ecosystems/npm/registry';

describe('npm', () => {
  it('client treats 404 as not found', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const result = await fetchNpmPublishedVersion('missing-package', { fetchImpl });

    expect(result.version).toBeNull();
  });
});
