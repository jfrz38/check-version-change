import type { RegistryClient } from '../../contracts/registry-client';
import { PackageName } from '../../domain/value-objects/package-name';
import { PublishedVersion } from '../../domain/value-objects/published-version';
import { Version } from '../../domain/value-objects/version';
import type { FetchJsonOptions, PublishedPackageInfo } from '../../types';
import { fetchTextWithRetry } from '../../utils/http';
import { getChild, getChildText, parseXml } from './xml';

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
    const groupPath = groupId.split('.').join('/');
    const url = `https://repo1.maven.org/maven2/${groupPath}/${artifactId}/maven-metadata.xml`;

    const response = await fetchTextWithRetry(url, {
      ...options,
      headers: {
        accept: 'application/xml',
        ...options.headers,
      },
      missingStatusCodes: [401, 403, 404],
    });

    if (!response.found) {
      return new PublishedVersion(null);
    }

    const metadata = parseXml(response.data ?? '');
    const versioning = getChild(metadata, 'versioning');
    const version = getChildText(versioning ?? metadata, 'latest')
      ?? getChildText(versioning ?? metadata, 'release');
    return new PublishedVersion(version ? new Version(version) : null);
  }
}

export async function fetchMavenCentralPublishedVersion(packageName: string, options: FetchJsonOptions = {}): Promise<PublishedPackageInfo> {
  const result = await new MavenCentralRegistryClient().fetchPublishedVersion(new PackageName(packageName), options);
  return { version: result.version?.value ?? null };
}
