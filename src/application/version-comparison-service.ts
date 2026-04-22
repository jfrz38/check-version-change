import type { Version } from '../domain/value-objects/version';
import { compareSemverVersions } from '../utils/semver';

export interface VersionComparison {
  changed: boolean;
  isHigher: boolean;
  warning?: string;
}

export function compareVersions(localVersion: Version, comparedVersion: string, compareSemver: boolean): VersionComparison {
  const changed = !comparedVersion || localVersion.value !== comparedVersion;

  if (!comparedVersion || !compareSemver) {
    return {
      changed,
      isHigher: false,
    };
  }

  const comparison = compareSemverVersions(localVersion.value, comparedVersion);
  return {
    changed,
    isHigher: comparison.isHigher,
    warning: !comparison.comparable ? comparison.reason : undefined,
  };
}
