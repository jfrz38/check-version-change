export class GitFileNotFoundError extends Error {
  constructor(fileName: string, gitRef: string) {
    super(`Unable to find "${fileName}" in git ref "${gitRef}".`);
    this.name = 'GitFileNotFoundError';
  }
}
