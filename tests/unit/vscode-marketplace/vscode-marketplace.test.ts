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
    const fetchMock = vi.fn(async () => ({
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
    }));
    const fetchImpl = fetchMock as unknown as typeof fetch;

    const result = await fetchVsCodeMarketplacePublishedVersion('example.demo-extension', { fetchImpl });
    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String((request as RequestInit).body));

    expect(result.version).toBe('4.5.6');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=7.2-preview.1',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(body).toEqual({
      filters: [
        {
          criteria: [
            {
              filterType: 7,
              value: 'example.demo-extension',
            },
            {
              filterType: 8,
              value: 'Microsoft.VisualStudio.Code',
            },
          ],
          pageNumber: 1,
          pageSize: 1,
          sortBy: 0,
          sortOrder: 0,
        },
      ],
      assetTypes: [],
      flags: 513,
    });
  });

  it('client includes marketplace error details when the query fails', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'invalid query',
    })) as unknown as typeof fetch;

    await expect(fetchVsCodeMarketplacePublishedVersion('example.demo-extension', { fetchImpl }))
      .rejects.toThrow(/400 Bad Request: invalid query/);
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
