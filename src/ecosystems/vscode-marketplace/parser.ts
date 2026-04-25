import type { PackageParser } from '../../contracts/package-parser';
import { LocalPackageCandidate } from '../../domain/value-objects/local-package-candidate';
import { PackageName } from '../../domain/value-objects/package-name';
import { Version } from '../../domain/value-objects/version';

export class VsCodeExtensionParser implements PackageParser {
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
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const publisher = typeof candidate.publisher === 'string' ? candidate.publisher.trim() : '';
    const version = typeof candidate.version === 'string' ? candidate.version.trim() : '';

    if (!publisher) {
      throw new Error('package.json is missing a non-empty "publisher" field for VS Code Marketplace lookup.');
    }

    if (!name) {
      throw new Error('package.json is missing a non-empty "name" field.');
    }

    if (!version) {
      throw new Error('package.json is missing a non-empty "version" field.');
    }

    return new LocalPackageCandidate(
      new PackageName(`${publisher}.${name}`),
      new Version(version),
    );
  }
}

export function parseVsCodeExtensionPackageJson(content: string) {
  const parsed = new VsCodeExtensionParser().parse('package.json', content);
  return {
    packageName: parsed.packageName.value,
    version: parsed.version?.value,
  };
}
