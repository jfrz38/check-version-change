import * as semver from 'semver';

export interface SemverComparisonResult {
  comparable: boolean;
  isHigher: boolean;
  reason?: string;
}

export function compareSemverVersions(localVersion: string, publishedVersion: string): SemverComparisonResult {
  const normalizedLocal = semver.valid(localVersion, { loose: true });
  const normalizedPublished = semver.valid(publishedVersion, { loose: true });

  if (!normalizedLocal || !normalizedPublished) {
    return {
      comparable: false,
      isHigher: false,
      reason: `Non-semver version detected (local="${localVersion}", published="${publishedVersion}").`,
    };
  }

  return {
    comparable: true,
    isHigher: semver.gt(normalizedLocal, normalizedPublished),
  };
}
