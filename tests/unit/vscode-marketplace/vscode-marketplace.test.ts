import { describe, expect, it, vi } from 'vitest';
import { parseVsCodeExtensionPackageJson } from '../../../src/ecosystems/vscode-marketplace/parser';
import { fetchVsCodeMarketplacePublishedVersion } from '../../../src/ecosystems/vscode-marketplace/registry';

describe('vscode-marketplace', () => {
  it('parser resolves extension id from publisher and name', () => {
    const result = parseVsCodeExtensionPackageJson(JSON.stringify({
      publisher: 'example',
      name: 'demo-extension',
      version: '1.2.3',
      engines: {
        vscode: '^1.90.0',
      },
    }));

    expect(result).toEqual({
      packageName: 'example.demo-extension',
      version: '1.2.3',
    });
  });

  it('parser requires publisher for marketplace lookup', () => {
    expect(() => parseVsCodeExtensionPackageJson(JSON.stringify({
      name: 'demo-extension',
      version: '1.2.3',
    }))).toThrow(/publisher/i);
  });

  it('client posts an extension query and extracts the latest version', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        results: [
          {
            extensions: [
              {
                versions: [{ version: '4.5.6' }],
              },
            ],
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const result = await fetchVsCodeMarketplacePublishedVersion('example.demo-extension', { fetchImpl });

    expect(result.version).toBe('4.5.6');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=7.2-preview.1',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('example.demo-extension'),
      }),
    );
  });

  it('client treats an empty marketplace result as not found', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        results: [{ extensions: [] }],
      }),
    })) as unknown as typeof fetch;

    const result = await fetchVsCodeMarketplacePublishedVersion('example.missing', { fetchImpl });

    expect(result.version).toBeNull();
  });

});
