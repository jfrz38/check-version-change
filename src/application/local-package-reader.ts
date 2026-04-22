import { parseLocalPackageFile } from '../ecosystems/ecosystem-registry';
import type { CompareVersionRequest } from './compare-version-request';

export async function readLocalPackage(request: CompareVersionRequest) {
  return parseLocalPackageFile(request.filePath, request.versionPattern);
}
