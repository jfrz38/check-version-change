import { parseLocalPackageFileForRegistry } from '../ecosystems/ecosystem-registry';
import type { SupportedRegistry } from '../types';
import type { CompareVersionRequest } from './compare-version-request';

export async function readLocalPackage(request: CompareVersionRequest, registry: SupportedRegistry) {
  return parseLocalPackageFileForRegistry(registry, request.filePath, request.versionPattern);
}
