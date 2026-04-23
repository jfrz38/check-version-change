import { PackageName } from './package-name';
import { Version } from './version';

export class LocalPackage {
  constructor(
    public readonly packageName: PackageName,
    public readonly version: Version,
  ) {}
}
