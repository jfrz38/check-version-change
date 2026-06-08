import type { ActionOutputs } from '../types';
import { VersionPolicyViolationError } from '../domain/errors/version-policy-violation-error';

export interface VersionFailurePolicy {
  failOnUnchanged: boolean;
  failOnNotHigher: boolean;
}

export function assertVersionFailurePolicy(outputs: ActionOutputs, policy: VersionFailurePolicy): void {
  if (policy.failOnUnchanged && !outputs.changed) {
    throw VersionPolicyViolationError.unchanged(outputs.localVersion);
  }

  if (policy.failOnNotHigher && outputs.comparedVersion && !outputs.isHigher) {
    throw VersionPolicyViolationError.notHigher(outputs.localVersion, outputs.comparedVersion);
  }
}
