import * as core from '@actions/core';
import type { ActionOutputs } from './types';
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
import { listFilesAtGitRef, readFileAtGitRef, resolveCompareFilePathAtGitRef, resolveGitCompareRef } from './utils/git';
import { fetchJsonWithRetry } from './utils/http';
import { extractVersionFromPattern, countCaptureGroups } from './utils/version-pattern';
import { parseLocalPackageContent } from './ecosystems/ecosystem-registry';
import { CompareVersionRequest } from './application/compare-version-request';
import { compareVersion, executeCompareVersion } from './application/compare-version-use-case';
import { CompareSource } from './domain/value-objects/compare-source';

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
  listFilesAtGitRef,
  resolveCompareFilePathAtGitRef,
  resolveGitCompareRef,
  CompareSource,
  CompareVersionRequest,
  compareVersion,
  executeCompareVersion,
};

export async function run(): Promise<ActionOutputs> {
  const request = new CompareVersionRequest({
    cwd: process.cwd(),
    registry: (core.getInput('registry') || 'auto').trim().toLowerCase() as never,
    compareSource: CompareSource.fromInput(core.getInput('compare-source')),
    filePath: core.getInput('file-path', { required: true }).trim(),
    compareFilePath: core.getInput('compare-file-path').trim(),
    packageNameOverride: core.getInput('package-name').trim(),
    compareRef: core.getInput('compare-ref').trim(),
    versionPattern: core.getInput('version-pattern').trim(),
    compareSemver: getBooleanInput('compare-semver', true),
  });
  const result = await executeCompareVersion(request);
  if (result.warning) {
    core.warning(`Semver comparison skipped: ${result.warning}`);
  }
  const outputs = result.outputs;

  setOutputs(outputs);
  return outputs;
}

if (require.main === module) {
  run().catch((error) => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}
