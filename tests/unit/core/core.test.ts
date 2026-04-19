import { describe, expect, it } from 'vitest';
import { compareSemverVersions } from '../../../src/utils/semver';
import { extractVersionFromPattern } from '../../../src/utils/version-pattern';

describe('core', () => {
  it('version pattern requires exactly one capture group', () => {
    expect(() => extractVersionFromPattern('version="1.2.3"', '(version)="([^"]+)"')).toThrow(
      /exactly one capture group/i,
    );
  });

  it('semver comparison is conservative for invalid versions', () => {
    const result = compareSemverVersions('release-7', '1.0.0');

    expect(result.comparable).toBe(false);
    expect(result.isHigher).toBe(false);
  });
});
