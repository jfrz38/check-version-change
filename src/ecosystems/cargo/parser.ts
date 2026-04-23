import type { PackageParser } from '../../contracts/package-parser';
import { LocalPackageCandidate } from '../../domain/value-objects/local-package-candidate';
import { PackageName } from '../../domain/value-objects/package-name';
import { Version } from '../../domain/value-objects/version';
import { getTomlString, parseToml } from '../pypi/toml';

export class CargoTomlParser implements PackageParser {
  parse(_filePath: string, content: string): LocalPackageCandidate {
    const document = parseToml(content);

    const packageName = getTomlString(document, ['package', 'name']);
    const packageVersion = getTomlString(document, ['package', 'version']);
    const workspaceVersion = getTomlString(document, ['workspace', 'package', 'version']);

    if (!packageName) {
      throw new Error('Cargo.toml is missing [package].name.');
    }

    const version = packageVersion ?? workspaceVersion;
    if (!version) {
      throw new Error('Cargo.toml is missing [package].version. If the crate version is inherited or generated, pass "version-pattern".');
    }

    return new LocalPackageCandidate(new PackageName(packageName), new Version(version));
  }
}

export function parseCargoToml(content: string) {
  const parsed = new CargoTomlParser().parse('Cargo.toml', content);
  return {
    packageName: parsed.packageName.value,
    version: parsed.version?.value,
  };
}
