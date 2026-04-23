import type { ActionOutputs, RegistryInput, SupportedRegistry } from '../types';
import { detectRegistryFromFile } from '../ecosystems/ecosystem-registry';
import { buildActionOutputs } from './action-output-mapper';
import type { CompareVersionRequest } from './compare-version-request';
import { readLocalPackage } from './local-package-reader';
import { resolveComparisonVersion } from './comparison-version-resolver';
import { compareVersions } from './version-comparison-service';

function resolveRegistry(inputRegistry: RegistryInput, filePath: string): SupportedRegistry {
  if (inputRegistry === 'auto') {
    return detectRegistryFromFile(filePath);
  }

  if (inputRegistry !== 'npm' && inputRegistry !== 'pypi' && inputRegistry !== 'maven-central' && inputRegistry !== 'crates-io' && inputRegistry !== 'go-proxy') {
    throw new Error(`Unsupported registry "${inputRegistry}". Expected "auto", "npm", "pypi", "maven-central", "crates-io", or "go-proxy".`);
  }

  return inputRegistry;
}

export interface CompareVersionExecution {
  outputs: ActionOutputs;
  warning?: string;
}

export async function executeCompareVersion(request: CompareVersionRequest): Promise<CompareVersionExecution> {
  const registryDetected = resolveRegistry(request.registry, request.filePath);
  const localPackage = await readLocalPackage(request);
  const packageNameDetected = request.packageNameOverride || localPackage.packageName.value;

  if (!packageNameDetected) {
    throw new Error('Package name could not be detected from the provided file. Pass the "package-name" input explicitly.');
  }

  const resolvedComparison = await resolveComparisonVersion(request, registryDetected, packageNameDetected);
  const comparison = compareVersions(localPackage.version, resolvedComparison.comparedVersion, request.compareSemver);

  return {
    outputs: buildActionOutputs({
      changed: comparison.changed,
      localVersion: localPackage.version.value,
      comparedVersion: resolvedComparison.comparedVersion,
      isHigher: comparison.isHigher,
      registryDetected: resolvedComparison.registryDetected,
      packageNameDetected,
      compareSource: request.compareSource,
      compareRefResolved: resolvedComparison.compareRefResolved,
      compareFilePathResolved: resolvedComparison.compareFilePathResolved,
    }),
    warning: comparison.warning,
  };
}

export async function compareVersion(request: CompareVersionRequest): Promise<ActionOutputs> {
  const result = await executeCompareVersion(request);
  return result.outputs;
}
