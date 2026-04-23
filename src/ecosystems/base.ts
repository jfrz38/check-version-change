import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { LocalPackage } from '../domain/value-objects/local-package';
import { LocalPackageCandidate } from '../domain/value-objects/local-package-candidate';
import { Version } from '../domain/value-objects/version';
import type { EcosystemHandler, FetchJsonOptions, SupportedRegistry } from '../types';
import { extractVersionFromPattern } from '../utils/version-pattern';

export abstract class BaseEcosystemHandler implements EcosystemHandler {
  readonly registry: SupportedRegistry;
  private readonly supportedFileNames: Set<string>;

  protected constructor(registry: SupportedRegistry, supportedFileNames: string[]) {
    this.registry = registry;
    this.supportedFileNames = new Set(supportedFileNames.map((fileName) => fileName.toLowerCase()));
  }

  supports(filePath: string): boolean {
    return this.supportedFileNames.has(path.basename(filePath).toLowerCase());
  }

  async parseLocalPackage(filePath: string, versionPattern?: string): Promise<LocalPackage> {
    const content = await readFile(filePath, 'utf8');
    return this.parseLocalPackageContent(filePath, content, versionPattern);
  }

  async parseLocalPackageContent(filePath: string, content: string, versionPattern?: string): Promise<LocalPackage> {
    const parsed = await this.parseFromFile(filePath, content);

    if (versionPattern) {
      return new LocalPackage(
        parsed.packageName,
        new Version(extractVersionFromPattern(content, versionPattern)),
      );
    }

    if (!parsed.version) {
      throw new Error(`Unable to detect a local version from "${filePath}". Pass "version-pattern" for this file type.`);
    }

    return new LocalPackage(parsed.packageName, parsed.version);
  }

  fetchPublishedVersion(packageName: string, options?: FetchJsonOptions): Promise<string> {
    return this.fetchPublishedVersionInternal(packageName, options);
  }

  protected abstract parseFromFile(filePath: string, content: string): Promise<LocalPackageCandidate> | LocalPackageCandidate;

  protected abstract fetchPublishedVersionInternal(packageName: string, options?: FetchJsonOptions): Promise<string>;
}
