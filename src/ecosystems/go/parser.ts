import type { PackageParser } from '../../contracts/package-parser';
import { LocalPackageCandidate } from '../../domain/value-objects/local-package-candidate';
import { PackageName } from '../../domain/value-objects/package-name';

export class GoModParser implements PackageParser {
  parse(_filePath: string, content: string): LocalPackageCandidate {
    const match = content.match(/^\s*module\s+([^\s]+)\s*$/m);
    const packageName = match?.[1]?.trim();

    if (!packageName) {
      throw new Error('go.mod is missing a valid module directive.');
    }

    return new LocalPackageCandidate(new PackageName(packageName));
  }
}

export function parseGoMod(content: string) {
  const parsed = new GoModParser().parse('go.mod', content);
  return {
    packageName: parsed.packageName.value,
  };
}
