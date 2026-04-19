import { describe, expect, it, vi } from 'vitest';
import { parseCargoToml } from '../../src/ecosystems/cargo/parser';
import { fetchCratesIoPublishedVersion } from '../../src/ecosystems/cargo/registry';

describe('cargo', () => {
  it('parser reads package name and version', () => {
    const result = parseCargoToml(`
[package]
name = "demo-crate"
version = "1.4.0"
`);

    expect(result).toEqual({
      packageName: 'demo-crate',
      version: '1.4.0',
    });
  });

  it('client extracts highest non-yanked version from sparse index', async () => {
    const fetchImpl = vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => [
          JSON.stringify({ vers: '1.0.0', yanked: false }),
          JSON.stringify({ vers: '1.2.0', yanked: true }),
          JSON.stringify({ vers: '1.1.5', yanked: false }),
        ].join('\n'),
      })) as unknown as typeof fetch;

    const result = await fetchCratesIoPublishedVersion('demo-crate', { fetchImpl });

    expect(result.version).toBe('1.1.5');
  });
});
