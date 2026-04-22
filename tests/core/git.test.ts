import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { readFileAtGitRef, resolveGitCompareRef } from '../../src/utils/git';

describe('git utils', () => {
  it('prefers the explicit compare ref when provided', () => {
    const result = resolveGitCompareRef('release/1.x', {
      baseRef: 'main',
      payload: {
        pull_request: {
          base: {
            ref: 'main',
            sha: 'abc123',
          },
        },
      },
    } as never);

    expect(result).toBe('release/1.x');
  });

  it('falls back to the pull request base sha', () => {
    const result = resolveGitCompareRef('', {
      baseRef: 'main',
      payload: {
        pull_request: {
          base: {
            ref: 'main',
            sha: 'abc123',
          },
        },
      },
    } as never);

    expect(result).toBe('abc123');
  });

  it('reads a file from a git ref using a repository-relative path', async () => {
    const execFileImpl = vi.fn().mockResolvedValue({ stdout: '{"version":"1.2.3"}', stderr: '' });
    const repoRoot = path.resolve('/repo');
    const filePath = path.join(repoRoot, 'packages', 'demo', 'package.json');

    const result = await readFileAtGitRef(repoRoot, filePath, 'main', { execFileImpl });

    expect(result).toBe('{"version":"1.2.3"}');
    expect(execFileImpl).toHaveBeenCalledWith('git', ['show', 'main:packages/demo/package.json'], expect.objectContaining({
      cwd: repoRoot,
      encoding: 'utf8',
    }));
  });

  it('rejects files outside the repository root', async () => {
    const repoRoot = path.resolve('/repo');
    const filePath = path.resolve('/other/package.json');

    await expect(readFileAtGitRef(repoRoot, filePath, 'main')).rejects.toThrow(/must be inside the repository root/i);
  });
});
