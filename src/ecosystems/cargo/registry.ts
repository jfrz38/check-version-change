import * as semver from 'semver';
import type { RegistryClient } from '../../contracts/registry-client';
import { PackageName } from '../../domain/value-objects/package-name';
import { PublishedVersion } from '../../domain/value-objects/published-version';
import { Version } from '../../domain/value-objects/version';
import type { FetchJsonOptions, PublishedPackageInfo } from '../../types';
import { fetchJsonWithRetry } from '../../utils/http';

interface CargoIndexEntry {
  vers?: string;
  yanked?: boolean;
}

function getCrateIndexPath(packageName: string): string {
  const lower = packageName.toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(lower)) {
    throw new Error(`Unsupported crate name "${packageName}".`);
  }

  if (lower.length === 1) {
    return `1/${lower}`;
  }
  if (lower.length === 2) {
    return `2/${lower}`;
  }
  if (lower.length === 3) {
    return `3/${lower[0]}/${lower}`;
  }

  return `${lower.slice(0, 2)}/${lower.slice(2, 4)}/${lower}`;
}

export class CratesIoRegistryClient implements RegistryClient {
  readonly registry = 'crates-io' as const;

  async fetchPublishedVersion(packageName: PackageName, options: FetchJsonOptions = {}): Promise<PublishedVersion> {
    const url = `https://index.crates.io/${getCrateIndexPath(packageName.value)}`;
    const fetchImpl = options.fetchImpl ?? fetch;

    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          headers: {
            accept: 'text/plain',
            ...options.headers,
          },
        });

        if ([401, 403, 404].includes(response.status)) {
          return new PublishedVersion(null);
        }

        if (!response.ok) {
          if (response.status >= 500 && attempt === 1) {
            continue;
          }
          throw new Error(`Request failed with status ${response.status} ${response.statusText}`.trim());
        }

        const body = await response.text();
        const entries = body
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line) as CargoIndexEntry)
          .filter((entry) => typeof entry.vers === 'string' && !entry.yanked);

        const versions = entries
          .map((entry) => semver.valid(entry.vers ?? '', { loose: true }))
          .filter((entry): entry is string => Boolean(entry))
          .sort(semver.compare);

        return new PublishedVersion(versions.length > 0 ? new Version(versions[versions.length - 1]) : null);
      } catch (error) {
        lastError = error;
        if (attempt === 2) {
          break;
        }
      }
    }

    throw new Error(`Unable to fetch registry metadata from ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }
}

export async function fetchCratesIoPublishedVersion(packageName: string, options: FetchJsonOptions = {}): Promise<PublishedPackageInfo> {
  const result = await new CratesIoRegistryClient().fetchPublishedVersion(new PackageName(packageName), options);
  return { version: result.version?.value ?? null };
}
