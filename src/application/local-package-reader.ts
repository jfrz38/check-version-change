import { readFile } from 'node:fs/promises';
import { Version } from '../domain/value-objects/version';
import { parseLocalPackageFileForRegistry } from '../ecosystems/ecosystem-registry';
import { extractVersionFromPattern } from '../utils/version-pattern';
import type { SupportedRegistry } from '../types';
import type { CompareVersionRequest } from './compare-version-request';

export async function readLocalPackage(request: CompareVersionRequest, registry: SupportedRegistry) {
  return parseLocalPackageFileForRegistry(registry, request.filePath, request.versionPattern);
}

export async function readRawLocalVersion(filePath: string, versionPattern: string): Promise<Version> {
  const content = await readFile(filePath, 'utf8');
  return new Version(extractVersionFromPattern(content, versionPattern));
}
