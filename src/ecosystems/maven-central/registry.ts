import type { RegistryClient } from '../../contracts/registry-client';
import { PackageName } from '../../domain/value-objects/package-name';
import { PublishedVersion } from '../../domain/value-objects/published-version';
import { Version } from '../../domain/value-objects/version';
import type { FetchJsonOptions, PublishedPackageInfo } from '../../types';
import { fetchJsonWithRetry } from '../../utils/http';

interface MavenCentralResponse {
  response?: {
    docs?: Array<{
      latestVersion?: string;
    }>;
  };
}

function parseCoordinates(packageName: string): { groupId: string; artifactId: string } {
  const parts = packageName.split(':');
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
    throw new Error('Maven Central lookups require "package-name" in "groupId:artifactId" format.');
  }

  return {
    groupId: parts[0].trim(),
    artifactId: parts[1].trim(),
  };
}

export class MavenCentralRegistryClient implements RegistryClient {
  readonly registry = 'maven-central' as const;

  async fetchPublishedVersion(packageName: PackageName, options: FetchJsonOptions = {}): Promise<PublishedVersion> {
    const { groupId, artifactId } = parseCoordinates(packageName.value);
    const query = encodeURIComponent(`g:${groupId} AND a:${artifactId}`);
    const url = `https://search.maven.org/solrsearch/select?q=${query}&rows=1&wt=json`;

    const response = await fetchJsonWithRetry<MavenCentralResponse>(url, {
      ...options,
      missingStatusCodes: [401, 403, 404],
    });

    if (!response.found) {
      return new PublishedVersion(null);
    }

    const version = response.data?.response?.docs?.[0]?.latestVersion?.trim();
    return new PublishedVersion(version ? new Version(version) : null);
  }
}

export async function fetchMavenCentralPublishedVersion(packageName: string, options: FetchJsonOptions = {}): Promise<PublishedPackageInfo> {
  const result = await new MavenCentralRegistryClient().fetchPublishedVersion(new PackageName(packageName), options);
  return { version: result.version?.value ?? null };
}
