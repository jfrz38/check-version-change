import * as github from '@actions/github';
import { ecosystemRegistry } from '../ecosystems/ecosystem-registry';
import { parseLocalPackageContentForRegistry } from '../ecosystems/ecosystem-registry';
import { GitFileNotFoundError } from '../utils/errors/git-file-not-found-error';
import { readFileAtGitRef, resolveCompareFilePathAtGitRef, resolveGitCompareRef } from '../utils/git';
import { extractVersionFromPattern } from '../utils/version-pattern';
import type { SupportedRegistry } from '../types';
import type { CompareVersionRequest } from './compare-version-request';

export interface ResolvedComparisonVersion {
  comparedVersion: string;
  registryDetected: SupportedRegistry | '';
  compareRefResolved: string;
  compareFilePathResolved: string;
}

export async function resolveComparisonVersion(
  request: CompareVersionRequest,
  registryDetected: SupportedRegistry | '',
  packageNameDetected: string,
): Promise<ResolvedComparisonVersion> {
  if (request.compareSource.isRegistry()) {
    if (!registryDetected) {
      throw new Error('A registry is required when compare-source is "registry".');
    }

    const userAgent = `check-version-change/${github.context.runId || 'local'}`;
    const headers = { 'user-agent': userAgent };

    return {
      comparedVersion: await ecosystemRegistry.fetchPublishedVersion(registryDetected, packageNameDetected, { headers }),
      registryDetected,
      compareRefResolved: '',
      compareFilePathResolved: '',
    };
  }

  const compareRefResolved = resolveGitCompareRef(request.compareRef, github.context);
  let compareFilePathResolved: string;
  try {
    compareFilePathResolved = await resolveCompareFilePathAtGitRef(
      request.cwd,
      request.compareFilePath,
      compareRefResolved,
      request.hasExplicitCompareFilePath,
    );
  } catch (error) {
    if (request.allowMissingCompareFile && error instanceof GitFileNotFoundError) {
      return {
        comparedVersion: '',
        registryDetected: '',
        compareRefResolved,
        compareFilePathResolved: '',
      };
    }

    throw error;
  }
  const compareContent = await readFileAtGitRef(request.cwd, compareFilePathResolved, compareRefResolved);
  let comparedVersion: string;
  if (request.fileFormat.isRaw()) {
    if (!request.versionPattern) {
      throw new Error('The "version-pattern" input is required when file-format is "raw".');
    }
    comparedVersion = extractVersionFromPattern(compareContent, request.versionPattern);
  } else {
    if (!registryDetected) {
      throw new Error('A registry is required when file-format is "auto".');
    }
    comparedVersion = (await parseLocalPackageContentForRegistry(
      registryDetected,
      compareFilePathResolved,
      compareContent,
      request.versionPattern,
    )).version.value;
  }

  return {
    comparedVersion,
    registryDetected: '',
    compareRefResolved,
    compareFilePathResolved,
  };
}
