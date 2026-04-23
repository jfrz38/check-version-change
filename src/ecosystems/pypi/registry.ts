import type { RegistryClient } from '../../contracts/registry-client';
import { PackageName } from '../../domain/value-objects/package-name';
import { PublishedVersion } from '../../domain/value-objects/published-version';
import { Version } from '../../domain/value-objects/version';
import type { FetchJsonOptions, PublishedPackageInfo } from '../../types';
import { fetchJsonWithRetry } from '../../utils/http';

interface PypiRegistryResponse {
  info?: {
    version?: string;
  };
}

export class PypiRegistryClient implements RegistryClient {
  readonly registry = 'pypi' as const;

  async fetchPublishedVersion(packageName: PackageName, options: FetchJsonOptions = {}): Promise<PublishedVersion> {
    const encodedName = encodeURIComponent(packageName.value);
    const response = await fetchJsonWithRetry<PypiRegistryResponse>(`https://pypi.org/pypi/${encodedName}/json`, {
      ...options,
      missingStatusCodes: [401, 403, 404],
    });

    if (!response.found) {
      return new PublishedVersion(null);
    }

    const version = response.data?.info?.version?.trim();
    return new PublishedVersion(version ? new Version(version) : null);
  }
}

export async function fetchPypiPublishedVersion(packageName: string, options: FetchJsonOptions = {}): Promise<PublishedPackageInfo> {
  const result = await new PypiRegistryClient().fetchPublishedVersion(new PackageName(packageName), options);
  return { version: result.version?.value ?? null };
}
