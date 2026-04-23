import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { listFilesAtGitRef, readFileAtGitRef, resolveCompareFilePathAtGitRef, resolveGitCompareRef } from '../../../src/utils/git';

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

  it('lists files from a git ref', async () => {
    const execFileImpl = vi.fn().mockResolvedValue({ stdout: 'package.json\napps/web/package.json\n', stderr: '' });

    const result = await listFilesAtGitRef('/repo', 'main', { execFileImpl });

    expect(result).toEqual(['package.json', 'apps/web/package.json']);
  });

  it('falls back to searching by file name when the same path does not exist', async () => {
    const execFileImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('missing'))
      .mockResolvedValueOnce({ stdout: 'apps/web/package.json\nREADME.md\n', stderr: '' });

    const result = await resolveCompareFilePathAtGitRef('/repo', '/repo/package.json', 'main', false, { execFileImpl });

    expect(result).toBe(path.resolve('/repo', 'apps/web/package.json'));
  });

  it('does not search alternative paths when compare-file-path is explicit', async () => {
    const execFileImpl = vi.fn().mockRejectedValue(new Error('missing'));

    await expect(
      resolveCompareFilePathAtGitRef('/repo', '/repo/package.json', 'main', true, { execFileImpl }),
    ).rejects.toThrow(/missing/i);
  });
});
