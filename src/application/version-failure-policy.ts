import type { ActionOutputs } from '../types';
import { VersionNotHigherError, VersionUnchangedError } from '../domain/errors/version-policy-violation-error';

export interface VersionFailurePolicy {
  failOnUnchanged: boolean;
  failOnNotHigher: boolean;
}

export function assertVersionFailurePolicy(outputs: ActionOutputs, policy: VersionFailurePolicy): void {
  if (policy.failOnUnchanged && !outputs.changed) {
    throw new VersionUnchangedError(outputs.localVersion);
  }

  if (policy.failOnNotHigher && outputs.comparedVersion && !outputs.isHigher) {
    throw new VersionNotHigherError(outputs.localVersion, outputs.comparedVersion);
  }
}
