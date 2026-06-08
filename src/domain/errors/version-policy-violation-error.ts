export class VersionPolicyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VersionPolicyViolationError';
  }

  static unchanged(localVersion: string): VersionPolicyViolationError {
    return new VersionPolicyViolationError(`Version ${localVersion} is unchanged from the compared version.`);
  }

  static notHigher(localVersion: string, comparedVersion: string): VersionPolicyViolationError {
    return new VersionPolicyViolationError(`Version ${localVersion} is not higher than compared version ${comparedVersion}.`);
  }
}
