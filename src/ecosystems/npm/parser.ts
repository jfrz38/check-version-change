import type { PackageParser } from '../../contracts/package-parser';
import { LocalPackageCandidate } from '../../domain/value-objects/local-package-candidate';
import { PackageName } from '../../domain/value-objects/package-name';
import { Version } from '../../domain/value-objects/version';

export class NpmPackageParser implements PackageParser {
  parse(_filePath: string, content: string): LocalPackageCandidate {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid package.json: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid package.json: expected a JSON object.');
    }

    const candidate = parsed as Record<string, unknown>;
    const packageName = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const version = typeof candidate.version === 'string' ? candidate.version.trim() : '';

    if (!packageName) {
      throw new Error('package.json is missing a non-empty "name" field.');
    }

    if (!version) {
      throw new Error('package.json is missing a non-empty "version" field.');
    }

    return new LocalPackageCandidate(
      new PackageName(packageName),
      new Version(version),
    );
  }
}

export function parsePackageJson(content: string) {
  const parsed = new NpmPackageParser().parse('package.json', content);
  return {
    packageName: parsed.packageName.value,
    version: parsed.version?.value,
  };
}
