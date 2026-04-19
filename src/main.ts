import * as core from '@actions/core';
import * as github from '@actions/github';
import path from 'node:path';
import type { ActionOutputs, RegistryInput, SupportedRegistry } from './types';
import { CargoEcosystem } from './ecosystems/cargo/ecosystem';
import { parseCargoToml } from './ecosystems/cargo/parser';
import { fetchCratesIoPublishedVersion } from './ecosystems/cargo/registry';
import { ecosystemRegistry, EcosystemRegistry, parseLocalPackageFile, detectRegistryFromFile } from './ecosystems/ecosystem-registry';
import { GoEcosystem } from './ecosystems/go/ecosystem';
import { parseGoMod } from './ecosystems/go/parser';
import { fetchGoProxyPublishedVersion } from './ecosystems/go/registry';
import { MavenCentralEcosystem } from './ecosystems/maven-central/ecosystem';
import { parseGradleBuildFile } from './ecosystems/maven-central/gradle';
import { parsePomXml } from './ecosystems/maven-central/pom';
import { fetchMavenCentralPublishedVersion } from './ecosystems/maven-central/registry';
import { NpmEcosystem } from './ecosystems/npm/ecosystem';
import { parsePackageJson } from './ecosystems/npm/parser';
import { fetchNpmPublishedVersion } from './ecosystems/npm/registry';
import { PypiEcosystem } from './ecosystems/pypi/ecosystem';
import { parsePyProjectToml } from './ecosystems/pypi/pyproject';
import { fetchPypiPublishedVersion } from './ecosystems/pypi/registry';
import { parseSetupPy } from './ecosystems/pypi/setup-py';
import { compareSemverVersions } from './utils/semver';
import { fetchJsonWithRetry } from './utils/http';
import { extractVersionFromPattern, countCaptureGroups } from './utils/version-pattern';

function getBooleanInput(name: string, defaultValue: boolean): boolean {
  const rawValue = core.getInput(name);
  if (!rawValue) {
    return defaultValue;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  throw new Error(`Input "${name}" must be either "true" or "false".`);
}

function resolveRegistry(inputRegistry: RegistryInput, filePath: string): SupportedRegistry {
  if (inputRegistry === 'auto') {
    return detectRegistryFromFile(filePath);
  }

  if (inputRegistry !== 'npm' && inputRegistry !== 'pypi' && inputRegistry !== 'maven-central' && inputRegistry !== 'crates-io' && inputRegistry !== 'go-proxy') {
    throw new Error(`Unsupported registry "${inputRegistry}". Expected "auto", "npm", "pypi", "maven-central", "crates-io", or "go-proxy".`);
  }

  return inputRegistry;
}

async function fetchPublishedVersion(registry: SupportedRegistry, packageName: string): Promise<string> {
  const userAgent = `check-version-change/${github.context.runId || 'local'}`;
  const headers = { 'user-agent': userAgent };
  return ecosystemRegistry.fetchPublishedVersion(registry, packageName, { headers });
}

function setOutputs(outputs: ActionOutputs): void {
  core.setOutput('changed', String(outputs.changed));
  core.setOutput('local-version', outputs.localVersion);
  core.setOutput('published-version', outputs.publishedVersion);
  core.setOutput('is-higher', String(outputs.isHigher));
  core.setOutput('registry-detected', outputs.registryDetected);
  core.setOutput('package-name-detected', outputs.packageNameDetected);
}

export const internal = {
  compareSemverVersions,
  countCaptureGroups,
  detectRegistryFromFile,
  ecosystemRegistry,
  EcosystemRegistry,
  CargoEcosystem,
  GoEcosystem,
  extractVersionFromPattern,
  fetchCratesIoPublishedVersion,
  fetchGoProxyPublishedVersion,
  fetchJsonWithRetry,
  fetchMavenCentralPublishedVersion,
  fetchNpmPublishedVersion,
  fetchPypiPublishedVersion,
  MavenCentralEcosystem,
  NpmEcosystem,
  parseCargoToml,
  parseGoMod,
  parseLocalPackageFile,
  parseGradleBuildFile,
  parsePackageJson,
  parsePomXml,
  parsePyProjectToml,
  parseSetupPy,
  PypiEcosystem,
};

export async function run(): Promise<ActionOutputs> {
  const rawRegistry = (core.getInput('registry') || 'auto').trim().toLowerCase() as RegistryInput;
  const relativeFilePath = core.getInput('file-path', { required: true }).trim();
  const filePath = path.resolve(process.cwd(), relativeFilePath);
  const packageNameOverride = core.getInput('package-name').trim();
  const versionPattern = core.getInput('version-pattern').trim();
  const compareSemver = getBooleanInput('compare-semver', true);

  const registryDetected = resolveRegistry(rawRegistry, filePath);
  const localPackage = await parseLocalPackageFile(filePath, versionPattern || undefined);
  const packageNameDetected = packageNameOverride || localPackage.packageName.value;

  if (!packageNameDetected) {
    throw new Error('Package name could not be detected from the provided file. Pass the "package-name" input explicitly.');
  }

  const publishedVersion = await fetchPublishedVersion(registryDetected, packageNameDetected);
  const changed = !publishedVersion || localPackage.version.value !== publishedVersion;

  let isHigher = false;
  if (publishedVersion && compareSemver) {
    const comparison = compareSemverVersions(localPackage.version.value, publishedVersion);
    isHigher = comparison.isHigher;

    if (!comparison.comparable && comparison.reason) {
      core.warning(`Semver comparison skipped: ${comparison.reason}`);
    }
  }

  const outputs: ActionOutputs = {
    changed,
    localVersion: localPackage.version.value,
    publishedVersion,
    isHigher,
    registryDetected,
    packageNameDetected,
  };

  setOutputs(outputs);
  return outputs;
}

if (require.main === module) {
  run().catch((error) => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}
