import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CargoEcosystem } from '../../../src/ecosystems/cargo/ecosystem';
import { parseCargoToml } from '../../../src/ecosystems/cargo/parser';
import { fetchCratesIoPublishedVersion } from '../../../src/ecosystems/cargo/registry';
import type { PackageManifestSource } from '../../../src/types';

function manifestSource(files: Record<string, string>, rootDirectory = path.resolve('/repo')): PackageManifestSource {
  const normalizedFiles = new Map(
    Object.entries(files).map(([filePath, content]) => [path.resolve(filePath), content]),
  );

  return {
    rootDirectory,
    async readFile(filePath: string) {
      return normalizedFiles.get(path.resolve(filePath));
    },
  };
}

describe('cargo', () => {
  it('parser reads package name and version', () => {
    const result = parseCargoToml(`
[package]
name = "demo-crate"
version = "1.4.0"
`);

    expect(result).toEqual({
      packageName: 'demo-crate',
      version: '1.4.0',
    });
  });

  it('parser accepts multiline TOML arrays', () => {
    const result = parseCargoToml(`
[package]
name = "demo-crate"
version = "1.4.0"
include = [
  "Cargo.lock",
  "Cargo.toml",
  "LICENSE",
  "README.md",
  "src/**/*.rs",
]
`);

    expect(result).toEqual({
      packageName: 'demo-crate',
      version: '1.4.0',
    });
  });

  it('resolves a package version inherited from its parent workspace', async () => {
    const memberPath = path.resolve('/repo/crates/demo/Cargo.toml');
    const result = await new CargoEcosystem().parseLocalPackageContent(memberPath, `
[package]
name = "demo-crate"
version.workspace = true
`, undefined, manifestSource({
      [path.resolve('/repo/Cargo.toml')]: `
[workspace]
members = ["crates/demo"]

[workspace.package]
version = "2.4.0"
`,
    }));

    expect(result.packageName.value).toBe('demo-crate');
    expect(result.version.value).toBe('2.4.0');
  });

  it('resolves package.workspace instead of searching only parent directories', async () => {
    const memberPath = path.resolve('/repo/packages/demo/Cargo.toml');
    const workspacePath = path.resolve('/repo/workspaces/rust/Cargo.toml');
    const result = await new CargoEcosystem().parseLocalPackageContent(memberPath, `
[package]
name = "demo-crate"
workspace = "../../workspaces/rust"
version.workspace = true
`, undefined, manifestSource({
      [workspacePath]: `
[workspace]
members = ["../../packages/demo"]

[workspace.package]
version = "3.1.0"
`,
    }));

    expect(result.version.value).toBe('3.1.0');
  });

  it('resolves an inherited version declared in the same root manifest', async () => {
    const filePath = path.resolve('/repo/Cargo.toml');
    const content = `
[workspace]

[workspace.package]
version = "1.8.0"

[package]
name = "root-crate"
version.workspace = true
`;

    const result = await new CargoEcosystem().parseLocalPackageContent(
      filePath,
      content,
      undefined,
      manifestSource({}),
    );

    expect(result.version.value).toBe('1.8.0');
  });

  it('does not use workspace.package.version unless the package inherits it', () => {
    expect(() => parseCargoToml(`
[workspace]

[workspace.package]
version = "1.8.0"

[package]
name = "root-crate"
`)).toThrow(/missing \[package\]\.version/i);
  });

  it('reports a missing inherited workspace version', async () => {
    const memberPath = path.resolve('/repo/crates/demo/Cargo.toml');

    await expect(new CargoEcosystem().parseLocalPackageContent(memberPath, `
[package]
name = "demo-crate"
version.workspace = true
`, undefined, manifestSource({
      [path.resolve('/repo/Cargo.toml')]: '[workspace]\nmembers = ["crates/demo"]',
    }))).rejects.toThrow(/missing \[workspace\.package\]\.version/i);
  });

  it('client extracts highest non-yanked version from sparse index', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => [
        JSON.stringify({ vers: '1.0.0', yanked: false }),
        JSON.stringify({ vers: '1.2.0', yanked: true }),
        JSON.stringify({ vers: '1.1.5', yanked: false }),
      ].join('\n'),
    })) as unknown as typeof fetch;

    const result = await fetchCratesIoPublishedVersion('demo-crate', { fetchImpl });

    expect(result.version).toBe('1.1.5');
  });
});
