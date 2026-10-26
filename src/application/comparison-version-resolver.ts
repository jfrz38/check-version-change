import * as github from '@actions/github';
import path from 'node:path';
import { ecosystemRegistry } from '../ecosystems/ecosystem-registry';
import { parseLocalPackageContentForRegistry } from '../ecosystems/ecosystem-registry';
import { GitFileNotFoundError } from '../utils/errors/git-file-not-found-error';
import { listFilesAtGitRef, readFileAtGitRef, resolveCompareFilePathAtGitRef, resolveGitCompareRef } from '../utils/git';
import { extractVersionFromPattern } from '../utils/version-pattern';
import type { PackageManifestSource, SupportedRegistry } from '../types';
import type { CompareVersionRequest } from './compare-version-request';

export interface ResolvedComparisonVersion {
  comparedVersion: string;
  registryDetected: SupportedRegistry | '';
  compareRefResolved: string;
  compareFilePathResolved: string;
}

function createGitRefManifestSource(repoRoot: string, gitRef: string): PackageManifestSource {
  let filesAtRefPromise: Promise<Set<string>> | undefined;

  return {
    rootDirectory: repoRoot,
    async readFile(filePath: string): Promise<string | undefined> {
      const relativePath = path.relative(repoRoot, filePath);
      if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return undefined;
      }

      const normalizedPath = relativePath.split(path.sep).join('/');
      filesAtRefPromise ??= listFilesAtGitRef(repoRoot, gitRef).then((files) => new Set(files));
      if (!(await filesAtRefPromise).has(normalizedPath)) {
        return undefined;
      }

      return readFileAtGitRef(repoRoot, filePath, gitRef);
    },
  };
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
      createGitRefManifestSource(request.cwd, compareRefResolved),
    )).version.value;
  }

  return {
    comparedVersion,
    registryDetected: '',
    compareRefResolved,
    compareFilePathResolved,
  };
}
