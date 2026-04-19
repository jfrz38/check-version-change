import { PackageName } from './package-name';
import { Version } from './version';

export class LocalPackageCandidate {
  constructor(
    public readonly packageName: PackageName,
    public readonly version?: Version,
  ) {}
}
