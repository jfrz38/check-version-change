export class VersionUnchangedError extends Error {
  constructor(localVersion: string) {
    super(`Version ${localVersion} is unchanged from the compared version.`);
    this.name = 'VersionUnchangedError';
  }
}

export class VersionNotHigherError extends Error {
  constructor(localVersion: string, comparedVersion: string) {
    super(`Version ${localVersion} is not higher than compared version ${comparedVersion}.`);
    this.name = 'VersionNotHigherError';
  }
}
