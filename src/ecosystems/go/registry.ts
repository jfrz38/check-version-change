import type { RegistryClient } from '../../contracts/registry-client';
import { PackageName } from '../../domain/value-objects/package-name';
import { PublishedVersion } from '../../domain/value-objects/published-version';
import { Version } from '../../domain/value-objects/version';
import type { FetchJsonOptions, PublishedPackageInfo } from '../../types';
import { fetchJsonWithRetry } from '../../utils/http';

interface GoProxyLatestResponse {
  Version?: string;
}

function escapeGoModulePath(modulePath: string): string {
  return modulePath.replace(/[A-Z]/g, (character) => `!${character.toLowerCase()}`);
}

export class GoProxyRegistryClient implements RegistryClient {
  readonly registry = 'go-proxy' as const;

  async fetchPublishedVersion(packageName: PackageName, options: FetchJsonOptions = {}): Promise<PublishedVersion> {
    const escapedPath = escapeGoModulePath(packageName.value);
    const url = `https://proxy.golang.org/${escapedPath}/@latest`;
    const response = await fetchJsonWithRetry<GoProxyLatestResponse>(url, {
      ...options,
      missingStatusCodes: [401, 403, 404],
    });

    if (!response.found) {
      return new PublishedVersion(null);
    }

    const version = response.data?.Version?.trim();
    return new PublishedVersion(version ? new Version(version) : null);
  }
}

export async function fetchGoProxyPublishedVersion(packageName: string, options: FetchJsonOptions = {}): Promise<PublishedPackageInfo> {
  const result = await new GoProxyRegistryClient().fetchPublishedVersion(new PackageName(packageName), options);
  return { version: result.version?.value ?? null };
}
