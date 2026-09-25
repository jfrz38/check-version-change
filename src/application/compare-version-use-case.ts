import { SUPPORTED_REGISTRIES, type ActionOutputs, type RegistryInput, type SupportedRegistry } from '../types';
import { detectRegistryFromFile } from '../ecosystems/ecosystem-registry';
import { buildActionOutputs } from './action-output-mapper';
import type { CompareVersionRequest } from './compare-version-request';
import { readLocalPackage, readRawLocalVersion } from './local-package-reader';
import { resolveComparisonVersion } from './comparison-version-resolver';
import { compareVersions } from './version-comparison-service';
import type { Version } from '../domain/value-objects/version';

function isSupportedRegistry(inputRegistry: string): inputRegistry is SupportedRegistry {
  return SUPPORTED_REGISTRIES.includes(inputRegistry as SupportedRegistry);
}

function resolveRegistry(inputRegistry: RegistryInput, filePath: string): SupportedRegistry {
  if (inputRegistry === 'auto') {
    return detectRegistryFromFile(filePath);
  }

  if (!isSupportedRegistry(inputRegistry)) {
    throw new Error(`Unsupported registry "${inputRegistry}". Expected "auto" or one of: ${SUPPORTED_REGISTRIES.join(', ')}.`);
  }

  return inputRegistry;
}

export interface CompareVersionExecution {
  outputs: ActionOutputs;
  warning?: string;
}

export async function executeCompareVersion(request: CompareVersionRequest): Promise<CompareVersionExecution> {
  if (request.fileFormat.isRaw() && request.compareSource.isRegistry()) {
    throw new Error('file-format "raw" can only be used with compare-source "git-ref".');
  }

  let registryDetected: SupportedRegistry | '';
  let localVersion: Version;
  let packageNameDetected: string;

  if (request.fileFormat.isRaw()) {
    if (!request.versionPattern) {
      throw new Error('The "version-pattern" input is required when file-format is "raw".');
    }

    registryDetected = '';
    localVersion = await readRawLocalVersion(request.filePath, request.versionPattern);
    packageNameDetected = request.packageNameOverride;
  } else {
    registryDetected = resolveRegistry(request.registry, request.filePath);
    const localPackage = await readLocalPackage(request, registryDetected);
    localVersion = localPackage.version;
    packageNameDetected = request.packageNameOverride || localPackage.packageName.value;

    if (!packageNameDetected) {
      throw new Error('Package name could not be detected from the provided file. Pass the "package-name" input explicitly.');
    }
  }

  const resolvedComparison = await resolveComparisonVersion(request, registryDetected, packageNameDetected);
  const comparison = compareVersions(localVersion, resolvedComparison.comparedVersion, request.compareSemver);

  return {
    outputs: buildActionOutputs({
      changed: comparison.changed,
      localVersion: localVersion.value,
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
