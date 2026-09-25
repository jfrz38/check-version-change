import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { runActionWithInputs } from '../../helpers/action-test-harness';
import { useTemporaryProject } from '../../helpers/smoke-test-helpers';

describe('raw file smoke', () => {
  const project = useTemporaryProject();

  it('compares a nested version with the same file at HEAD^', async () => {
    const tempProject = project.create({
      'wrapper/openapitools.json': JSON.stringify({
        'generator-cli': {
          version: '7.13.0',
        },
      }, null, 2),
    });
    const git = (...args: string[]) => execFileSync('git', args, { cwd: tempProject.dirPath, stdio: 'pipe' });
    git('init');
    git('config', 'user.email', 'smoke@example.com');
    git('config', 'user.name', 'Smoke Test');
    git('add', '.');
    git('commit', '-m', 'Initial generator version');

    fs.writeFileSync(tempProject.filePath('wrapper/openapitools.json'), JSON.stringify({
      'generator-cli': {
        version: '7.14.0',
      },
    }, null, 2));
    git('add', '.');
    git('commit', '-m', 'Update generator version');

    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempProject.dirPath);
    try {
      const { outputs } = await runActionWithInputs({
        'file-path': 'wrapper/openapitools.json',
        'compare-source': 'git-ref',
        'compare-ref': 'HEAD^',
        'file-format': 'raw',
        'version-pattern': '"version"\\s*:\\s*"([^"]+)"',
      });

      expect(outputs.changed).toBe('true');
      expect(outputs['local-version']).toBe('7.14.0');
      expect(outputs['compared-version']).toBe('7.13.0');
      expect(outputs['published-version']).toBe('7.13.0');
      expect(outputs['is-higher']).toBe('true');
      expect(outputs['registry-detected']).toBe('');
      expect(outputs['package-name-detected']).toBe('');
      expect(outputs['comparison-source-detected']).toBe('git-ref');
      expect(outputs['compare-ref-resolved']).toBe('HEAD^');
      expect(outputs['compare-file-path-resolved']).toBe(tempProject.filePath('wrapper/openapitools.json'));
    } finally {
      cwdSpy.mockRestore();
    }
  }, 15000);
});
