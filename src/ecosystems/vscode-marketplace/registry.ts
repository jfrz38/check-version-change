import type { RegistryClient } from '../../contracts/registry-client';
import { PackageName } from '../../domain/value-objects/package-name';
import { PublishedVersion } from '../../domain/value-objects/published-version';
import { Version } from '../../domain/value-objects/version';
import type { FetchJsonOptions, PublishedPackageInfo } from '../../types';

interface VsCodeMarketplaceVersion {
  version?: string;
}

interface VsCodeMarketplaceExtension {
  versions?: VsCodeMarketplaceVersion[];
}

interface VsCodeMarketplaceResult {
  extensions?: VsCodeMarketplaceExtension[];
}

interface VsCodeMarketplaceResponse {
  results?: VsCodeMarketplaceResult[];
}

const EXTENSION_NAME_FILTER = 7;
const INCLUDE_VERSIONS = 1;
const INCLUDE_LATEST_VERSION_ONLY = 512;

export class VsCodeMarketplaceRegistryClient implements RegistryClient {
  readonly registry = 'vscode-marketplace' as const;

  async fetchPublishedVersion(packageName: PackageName, options: FetchJsonOptions = {}): Promise<PublishedVersion> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const url = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=7.2-preview.1';
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        accept: 'application/json;api-version=7.2-preview.1;excludeUrls=true',
        'content-type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify({
        filters: [
          {
            criteria: [
              {
                filterType: EXTENSION_NAME_FILTER,
                value: packageName.value,
              },
            ],
          },
        ],
        flags: INCLUDE_VERSIONS | INCLUDE_LATEST_VERSION_ONLY,
      }),
    });

    if (response.status === 404) {
      return new PublishedVersion(null);
    }

    if (!response.ok) {
      throw new Error(`Unable to fetch registry metadata from ${url}: Request failed with status ${response.status} ${response.statusText}`.trim());
    }

    const data = (await response.json()) as VsCodeMarketplaceResponse;
    const version = data.results?.[0]?.extensions?.[0]?.versions?.[0]?.version?.trim();
    return new PublishedVersion(version ? new Version(version) : null);
  }
}

export async function fetchVsCodeMarketplacePublishedVersion(packageName: string, options: FetchJsonOptions = {}): Promise<PublishedPackageInfo> {
  const result = await new VsCodeMarketplaceRegistryClient().fetchPublishedVersion(new PackageName(packageName), options);
  return { version: result.version?.value ?? null };
}
