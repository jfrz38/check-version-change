import type { PackageParser } from '../../contracts/package-parser';
import { LocalPackageCandidate } from '../../domain/value-objects/local-package-candidate';
import { PackageName } from '../../domain/value-objects/package-name';
import { Version } from '../../domain/value-objects/version';
import { getTomlString, parseToml } from './toml';

export class PyProjectParser implements PackageParser {
  parse(_filePath: string, content: string): LocalPackageCandidate {
    const document = parseToml(content);

    const projectName = getTomlString(document, ['project', 'name']);
    const projectVersion = getTomlString(document, ['project', 'version']);

    if (projectName && projectVersion) {
      return new LocalPackageCandidate(new PackageName(projectName), new Version(projectVersion));
    }

    const poetryName = getTomlString(document, ['tool', 'poetry', 'name']);
    const poetryVersion = getTomlString(document, ['tool', 'poetry', 'version']);

    if (poetryName && poetryVersion) {
      return new LocalPackageCandidate(new PackageName(poetryName), new Version(poetryVersion));
    }

    if (projectName && !projectVersion) {
      throw new Error('pyproject.toml is missing [project].version and no [tool.poetry].version fallback was found.');
    }

    throw new Error('Unable to detect package name and version from pyproject.toml.');
  }
}

export function parsePyProjectToml(content: string) {
  const parsed = new PyProjectParser().parse('pyproject.toml', content);
  return {
    packageName: parsed.packageName.value,
    version: parsed.version?.value,
  };
}
