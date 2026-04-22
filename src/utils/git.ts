import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type * as github from '@actions/github';

const execFileAsync = promisify(execFile);

interface ReadFileAtGitRefOptions {
  execFileImpl?: typeof execFileAsync;
}

interface ListFilesAtGitRefOptions {
  execFileImpl?: typeof execFileAsync;
}

export function resolveGitCompareRef(rawCompareRef: string, context: typeof github.context): string {
  const explicitCompareRef = rawCompareRef.trim();
  if (explicitCompareRef) {
    return explicitCompareRef;
  }

  const pullRequestBaseSha = context.payload.pull_request?.base?.sha?.trim();
  if (pullRequestBaseSha) {
    return pullRequestBaseSha;
  }

  const pullRequestBaseRef = context.payload.pull_request?.base?.ref?.trim();
  if (pullRequestBaseRef) {
    return pullRequestBaseRef;
  }

  throw new Error('Input "compare-ref" is required when compare-source="git-ref" outside pull_request contexts.');
}

export async function readFileAtGitRef(
  repoRoot: string,
  filePath: string,
  gitRef: string,
  options: ReadFileAtGitRefOptions = {},
): Promise<string> {
  const relativePath = path.relative(repoRoot, filePath);

  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`File "${filePath}" must be inside the repository root "${repoRoot}".`);
  }

  const normalizedPath = relativePath.split(path.sep).join('/');
  const execFileImpl = options.execFileImpl ?? execFileAsync;

  try {
    const { stdout } = await execFileImpl('git', ['show', `${gitRef}:${normalizedPath}`], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 5,
    });

    return stdout;
  } catch (error) {
    const suffix = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read "${normalizedPath}" from git ref "${gitRef}": ${suffix}`);
  }
}

export async function listFilesAtGitRef(
  repoRoot: string,
  gitRef: string,
  options: ListFilesAtGitRefOptions = {},
): Promise<string[]> {
  const execFileImpl = options.execFileImpl ?? execFileAsync;

  try {
    const { stdout } = await execFileImpl('git', ['ls-tree', '-r', '--name-only', gitRef], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10,
    });

    return stdout
      .split(/\r?\n/u)
      .map((entry) => entry.trim())
      .filter(Boolean);
  } catch (error) {
    const suffix = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to list files from git ref "${gitRef}": ${suffix}`);
  }
}

export async function resolveCompareFilePathAtGitRef(
  repoRoot: string,
  filePath: string,
  gitRef: string,
  hasExplicitCompareFilePath: boolean,
  options: ReadFileAtGitRefOptions & ListFilesAtGitRefOptions = {},
): Promise<string> {
  try {
    await readFileAtGitRef(repoRoot, filePath, gitRef, options);
    return filePath;
  } catch (error) {
    if (hasExplicitCompareFilePath) {
      throw error;
    }
  }

  const targetBaseName = path.basename(filePath).toLowerCase();
  const candidates = (await listFilesAtGitRef(repoRoot, gitRef, options))
    .filter((candidate) => path.basename(candidate).toLowerCase() === targetBaseName);

  if (candidates.length === 0) {
    throw new Error(`Unable to find "${path.basename(filePath)}" in git ref "${gitRef}".`);
  }

  if (candidates.length > 1) {
    throw new Error(
      `Multiple files named "${path.basename(filePath)}" were found in git ref "${gitRef}". Pass "compare-file-path" explicitly.`,
    );
  }

  return path.resolve(repoRoot, candidates[0]);
}
