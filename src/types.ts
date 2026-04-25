import type { LocalPackage } from './domain/value-objects/local-package';
import type { PackageName } from './domain/value-objects/package-name';
import type { Version } from './domain/value-objects/version';

export const SUPPORTED_REGISTRIES = [
  'npm',
  'pypi',
  'maven-central',
  'crates-io',
  'go-proxy',
  'vscode-marketplace',
] as const;

export type SupportedRegistry = typeof SUPPORTED_REGISTRIES[number];
export type RegistryInput = SupportedRegistry | 'auto';
export type CompareSource = 'registry' | 'git-ref';

export interface LocalPackageInfo {
  packageName: PackageName;
  version?: Version;
}

export interface ResolvedLocalPackageInfo extends LocalPackageInfo {
  version: Version;
}

export interface PublishedPackageInfo {
  version: string | null;
}

export interface ActionInputs {
  filePath: string;
  compareFilePath?: string;
  packageNameOverride?: string;
  registry: RegistryInput;
  compareSource: CompareSource;
  compareRef?: string;
  versionPattern?: string;
  compareSemver: boolean;
}

export interface ActionOutputs {
  changed: boolean;
  localVersion: string;
  comparedVersion: string;
  publishedVersion: string;
  isHigher: boolean;
  registryDetected: SupportedRegistry | '';
  packageNameDetected: string;
  comparisonSourceDetected: CompareSource;
  compareRefResolved: string;
  compareFilePathResolved: string;
}

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  missingStatusCodes?: number[];
  fetchImpl?: typeof fetch;
}

export interface EcosystemHandler {
  readonly registry: SupportedRegistry;
  supports(filePath: string): boolean;
  parseLocalPackage(filePath: string, versionPattern?: string): Promise<LocalPackage>;
  parseLocalPackageContent(filePath: string, content: string, versionPattern?: string): Promise<LocalPackage>;
  fetchPublishedVersion(packageName: string, options?: FetchJsonOptions): Promise<string>;
}
