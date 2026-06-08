import { describe, expect, it } from 'vitest';
import { assertVersionFailurePolicy } from '../../../src/application/version-failure-policy';
import { VersionNotHigherError, VersionUnchangedError } from '../../../src/domain/errors/version-policy-violation-error';
import type { ActionOutputs } from '../../../src/types';

function buildOutputs(overrides: Partial<ActionOutputs> = {}): ActionOutputs {
  return {
    changed: true,
    localVersion: '1.2.0',
    comparedVersion: '1.1.0',
    publishedVersion: '1.1.0',
    isHigher: true,
    registryDetected: 'npm',
    packageNameDetected: 'demo-package',
    comparisonSourceDetected: 'registry',
    compareRefResolved: '',
    compareFilePathResolved: '',
    ...overrides,
  };
}

describe('version failure policy', () => {
  it('throws a domain error when fail-on-unchanged is enabled and versions are unchanged', () => {
    const outputs = buildOutputs({ changed: false, comparedVersion: '1.2.0', publishedVersion: '1.2.0', isHigher: false });

    expect(() => assertVersionFailurePolicy(outputs, { failOnUnchanged: true, failOnNotHigher: false })).toThrow(
      VersionUnchangedError,
    );
    expect(() => assertVersionFailurePolicy(outputs, { failOnUnchanged: true, failOnNotHigher: false })).toThrow(
      'Version 1.2.0 is unchanged from the compared version.',
    );
  });

  it('throws a domain error when fail-on-not-higher is enabled and local version is not higher', () => {
    const outputs = buildOutputs({ comparedVersion: '1.3.0', publishedVersion: '1.3.0', isHigher: false });

    expect(() => assertVersionFailurePolicy(outputs, { failOnUnchanged: false, failOnNotHigher: true })).toThrow(
      VersionNotHigherError,
    );
    expect(() => assertVersionFailurePolicy(outputs, { failOnUnchanged: false, failOnNotHigher: true })).toThrow(
      'Version 1.2.0 is not higher than compared version 1.3.0.',
    );
  });

  it('does not throw when fail-on-not-higher is enabled without a compared version', () => {
    const outputs = buildOutputs({ comparedVersion: '', publishedVersion: '', isHigher: false });

    expect(() => assertVersionFailurePolicy(outputs, { failOnUnchanged: false, failOnNotHigher: true })).not.toThrow();
  });
});
