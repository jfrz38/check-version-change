import * as github from '@actions/github';
import { ecosystemRegistry } from '../ecosystems/ecosystem-registry';
import { parseLocalPackageContentForRegistry } from '../ecosystems/ecosystem-registry';
import { GitFileNotFoundError } from '../utils/errors/git-file-not-found-error';
import { readFileAtGitRef, resolveCompareFilePathAtGitRef, resolveGitCompareRef } from '../utils/git';
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
  registryDetected: SupportedRegistry,
  packageNameDetected: string,
): Promise<ResolvedComparisonVersion> {
  if (request.compareSource.isRegistry()) {
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
  const comparedPackage = await parseLocalPackageContentForRegistry(registryDetected, compareFilePathResolved, compareContent, request.versionPattern);

  return {
    comparedVersion: comparedPackage.version.value,
    registryDetected: '',
    compareRefResolved,
    compareFilePathResolved,
  };
}
