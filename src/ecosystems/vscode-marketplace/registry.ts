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
const INSTALLATION_TARGET_FILTER = 8;
const INCLUDE_VERSIONS = 1;
const INCLUDE_LATEST_VERSION_ONLY = 512;
const VSCODE_INSTALLATION_TARGET = 'Microsoft.VisualStudio.Code';
const MAX_ATTEMPTS = 5;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause;
  if (cause instanceof Error && cause.message) {
    return `${error.message}: ${cause.message}`;
  }

  return error.message;
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export class VsCodeMarketplaceRegistryClient implements RegistryClient {
  readonly registry = 'vscode-marketplace' as const;

  async fetchPublishedVersion(packageName: PackageName, options: FetchJsonOptions = {}): Promise<PublishedVersion> {
    const fetchImpl = options.fetchImpl ?? fetch;
    const url = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=7.2-preview.1';

    const request = {
      filters: [
        {
          criteria: [
            {
              filterType: EXTENSION_NAME_FILTER,
              value: packageName.value,
            },
            {
              filterType: INSTALLATION_TARGET_FILTER,
              value: VSCODE_INSTALLATION_TARGET,
            },
          ],
          pageNumber: 1,
          pageSize: 1,
          sortBy: 0,
          sortOrder: 0,
        },
      ],
      assetTypes: [],
      flags: INCLUDE_VERSIONS | INCLUDE_LATEST_VERSION_ONLY,
    };

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          method: 'POST',
          headers: {
            accept: 'application/json;api-version=7.2-preview.1;excludeUrls=true',
            'content-type': 'application/json',
            ...options.headers,
          },
          body: JSON.stringify(request),
        });

        if (response.status === 404) {
          return new PublishedVersion(null);
        }

        if (!response.ok) {
          if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
            await wait(500 * attempt);
            continue;
          }

          const body = await readResponseBody(response);
          const suffix = body ? `: ${body}` : '';
          throw new Error(`Unable to fetch registry metadata from ${url}: Request failed with status ${response.status} ${response.statusText}${suffix}`.trim());
        }

        const data = (await response.json()) as VsCodeMarketplaceResponse;
        const version = data.results?.[0]?.extensions?.[0]?.versions?.[0]?.version?.trim();
        return new PublishedVersion(version ? new Version(version) : null);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith(`Unable to fetch registry metadata from ${url}:`)) {
          throw error;
        }
        lastError = error;
        if (attempt >= MAX_ATTEMPTS) {
          break;
        }
        await wait(500 * attempt);
      }
    }

    const suffix = formatError(lastError);
    throw new Error(`Unable to fetch registry metadata from ${url}: ${suffix}`);
  }
}

export async function fetchVsCodeMarketplacePublishedVersion(packageName: string, options: FetchJsonOptions = {}): Promise<PublishedPackageInfo> {
  const result = await new VsCodeMarketplaceRegistryClient().fetchPublishedVersion(new PackageName(packageName), options);
  return { version: result.version?.value ?? null };
}
