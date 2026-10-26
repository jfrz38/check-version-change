import type { PackageParser } from '../../contracts/package-parser';
import { LocalPackageCandidate } from '../../domain/value-objects/local-package-candidate';
import { PackageName } from '../../domain/value-objects/package-name';
import { Version } from '../../domain/value-objects/version';
import { getTomlString, parseToml } from '../pypi/toml';

interface CargoManifest {
  packageName?: string;
  packageVersion?: string;
  inheritsWorkspaceVersion: boolean;
  workspacePath?: string;
  definesWorkspace: boolean;
  workspaceVersion?: string;
}

function getTomlValue(document: Record<string, unknown>, valuePath: string[]): unknown {
  let current: unknown = document;

  for (const part of valuePath) {
    if (!current || typeof current !== 'object' || Array.isArray(current) || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export function inspectCargoToml(content: string): CargoManifest {
  const document = parseToml(content);
  const packageVersionValue = getTomlValue(document, ['package', 'version']);
  const workspaceValue = getTomlValue(document, ['workspace']);

  return {
    packageName: getTomlString(document, ['package', 'name']),
    packageVersion: typeof packageVersionValue === 'string' && packageVersionValue.trim()
      ? packageVersionValue.trim()
      : undefined,
    inheritsWorkspaceVersion: Boolean(
      packageVersionValue
      && typeof packageVersionValue === 'object'
      && !Array.isArray(packageVersionValue)
      && (packageVersionValue as Record<string, unknown>).workspace === true,
    ),
    workspacePath: getTomlString(document, ['package', 'workspace']),
    definesWorkspace: Boolean(workspaceValue && typeof workspaceValue === 'object' && !Array.isArray(workspaceValue)),
    workspaceVersion: getTomlString(document, ['workspace', 'package', 'version']),
  };
}

export class CargoTomlParser implements PackageParser {
  parse(_filePath: string, content: string): LocalPackageCandidate {
    const manifest = inspectCargoToml(content);

    if (!manifest.packageName) {
      throw new Error('Cargo.toml is missing [package].name.');
    }

    const version = manifest.packageVersion
      ?? (manifest.inheritsWorkspaceVersion && manifest.definesWorkspace ? manifest.workspaceVersion : undefined);
    if (!version) {
      throw new Error('Cargo.toml is missing [package].version. If the crate version is inherited or generated, pass "version-pattern".');
    }

    return new LocalPackageCandidate(new PackageName(manifest.packageName), new Version(version));
  }
}

export function parseCargoToml(content: string) {
  const parsed = new CargoTomlParser().parse('Cargo.toml', content);
  return {
    packageName: parsed.packageName.value,
    version: parsed.version?.value,
  };
}
