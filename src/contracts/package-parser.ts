import type { LocalPackageCandidate } from '../domain/value-objects/local-package-candidate';

export interface PackageParser {
  parse(filePath: string, content: string): Promise<LocalPackageCandidate> | LocalPackageCandidate;
}
