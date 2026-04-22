import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type * as github from '@actions/github';

const execFileAsync = promisify(execFile);

interface ReadFileAtGitRefOptions {
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
