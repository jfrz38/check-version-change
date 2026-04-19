import type { RegistryClient } from '../../contracts/registry-client';
import { PackageName } from '../../domain/value-objects/package-name';
import { PublishedVersion } from '../../domain/value-objects/published-version';
import { Version } from '../../domain/value-objects/version';
import type { FetchJsonOptions, PublishedPackageInfo } from '../../types';
import { fetchJsonWithRetry } from '../../utils/http';

interface NpmRegistryResponse {
  'dist-tags'?: {
    latest?: string;
  };
}

export class NpmRegistryClient implements RegistryClient {
  readonly registry = 'npm' as const;

  async fetchPublishedVersion(packageName: PackageName, options: FetchJsonOptions = {}): Promise<PublishedVersion> {
    const encodedName = encodeURIComponent(packageName.value);
    const response = await fetchJsonWithRetry<NpmRegistryResponse>(`https://registry.npmjs.org/${encodedName}`, {
      ...options,
      missingStatusCodes: [401, 403, 404],
    });

    if (!response.found) {
      return new PublishedVersion(null);
    }

    const version = response.data?.['dist-tags']?.latest?.trim();
    return new PublishedVersion(version ? new Version(version) : null);
  }
}

export async function fetchNpmPublishedVersion(packageName: string, options: FetchJsonOptions = {}): Promise<PublishedPackageInfo> {
  const result = await new NpmRegistryClient().fetchPublishedVersion(new PackageName(packageName), options);
  return { version: result.version?.value ?? null };
}
