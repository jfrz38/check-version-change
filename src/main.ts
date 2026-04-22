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
import { readFileAtGitRef, resolveGitCompareRef } from './utils/git';
import { fetchJsonWithRetry } from './utils/http';
import { extractVersionFromPattern, countCaptureGroups } from './utils/version-pattern';
import { parseLocalPackageContent } from './ecosystems/ecosystem-registry';
import type { CompareSource } from './types';

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

function resolveCompareSource(compareSource: string): CompareSource {
  const normalized = compareSource.trim().toLowerCase();
  if (!normalized || normalized === 'registry') {
    return 'registry';
  }

  if (normalized === 'git-ref') {
    return 'git-ref';
  }

  throw new Error(`Unsupported compare-source "${compareSource}". Expected "registry" or "git-ref".`);
}

async function fetchPublishedVersion(registry: SupportedRegistry, packageName: string): Promise<string> {
  const userAgent = `check-version-change/${github.context.runId || 'local'}`;
  const headers = { 'user-agent': userAgent };
  return ecosystemRegistry.fetchPublishedVersion(registry, packageName, { headers });
}

function setOutputs(outputs: ActionOutputs): void {
  core.setOutput('changed', String(outputs.changed));
  core.setOutput('local-version', outputs.localVersion);
  core.setOutput('compared-version', outputs.comparedVersion);
  core.setOutput('published-version', outputs.publishedVersion);
  core.setOutput('is-higher', String(outputs.isHigher));
  core.setOutput('registry-detected', outputs.registryDetected);
  core.setOutput('package-name-detected', outputs.packageNameDetected);
  core.setOutput('comparison-source-detected', outputs.comparisonSourceDetected);
  core.setOutput('compare-ref-resolved', outputs.compareRefResolved);
  core.setOutput('compare-file-path-resolved', outputs.compareFilePathResolved);
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
  parseLocalPackageContent,
  parseLocalPackageFile,
  parseGradleBuildFile,
  parsePackageJson,
  parsePomXml,
  parsePyProjectToml,
  parseSetupPy,
  PypiEcosystem,
  readFileAtGitRef,
  resolveGitCompareRef,
  resolveCompareSource,
};

export async function run(): Promise<ActionOutputs> {
  const rawRegistry = (core.getInput('registry') || 'auto').trim().toLowerCase() as RegistryInput;
  const compareSource = resolveCompareSource(core.getInput('compare-source') || 'registry');
  const relativeFilePath = core.getInput('file-path', { required: true }).trim();
  const filePath = path.resolve(process.cwd(), relativeFilePath);
  const relativeCompareFilePath = core.getInput('compare-file-path').trim();
  const compareFilePath = path.resolve(process.cwd(), relativeCompareFilePath || relativeFilePath);
  const packageNameOverride = core.getInput('package-name').trim();
  const compareRef = core.getInput('compare-ref').trim();
  const versionPattern = core.getInput('version-pattern').trim();
  const compareSemver = getBooleanInput('compare-semver', true);

  const registryDetected = resolveRegistry(rawRegistry, filePath);
  const localPackage = await parseLocalPackageFile(filePath, versionPattern || undefined);
  const packageNameDetected = packageNameOverride || localPackage.packageName.value;

  if (!packageNameDetected) {
    throw new Error('Package name could not be detected from the provided file. Pass the "package-name" input explicitly.');
  }

  let comparedVersion = '';
  let compareRefResolved = '';
  let compareFilePathResolved = '';

  if (compareSource === 'registry') {
    comparedVersion = await fetchPublishedVersion(registryDetected, packageNameDetected);
  } else {
    compareRefResolved = resolveGitCompareRef(compareRef, github.context);
    compareFilePathResolved = compareFilePath;
    const compareContent = await readFileAtGitRef(process.cwd(), compareFilePath, compareRefResolved);
    const comparedPackage = await parseLocalPackageContent(compareFilePath, compareContent, versionPattern || undefined);
    comparedVersion = comparedPackage.version.value;
  }

  const publishedVersion = comparedVersion;
  const changed = !comparedVersion || localPackage.version.value !== comparedVersion;

  let isHigher = false;
  if (comparedVersion && compareSemver) {
    const comparison = compareSemverVersions(localPackage.version.value, comparedVersion);
    isHigher = comparison.isHigher;

    if (!comparison.comparable && comparison.reason) {
      core.warning(`Semver comparison skipped: ${comparison.reason}`);
    }
  }

  const outputs: ActionOutputs = {
    changed,
    localVersion: localPackage.version.value,
    comparedVersion,
    publishedVersion,
    isHigher,
    registryDetected: compareSource === 'registry' ? registryDetected : '',
    packageNameDetected,
    comparisonSourceDetected: compareSource,
    compareRefResolved,
    compareFilePathResolved,
  };

  setOutputs(outputs);
  return outputs;
}

if (require.main === module) {
  run().catch((error) => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}
