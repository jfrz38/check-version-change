import type { PackageName } from '../domain/value-objects/package-name';
import type { PublishedVersion } from '../domain/value-objects/published-version';
import type { FetchJsonOptions, SupportedRegistry } from '../types';

export interface RegistryClient {
  readonly registry: SupportedRegistry;
  fetchPublishedVersion(packageName: PackageName, options?: FetchJsonOptions): Promise<PublishedVersion>;
}
