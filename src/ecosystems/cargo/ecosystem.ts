import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { LocalPackage } from '../../domain/value-objects/local-package';
import { PackageName } from '../../domain/value-objects/package-name';
import { Version } from '../../domain/value-objects/version';
import type { FetchJsonOptions, PackageManifestSource } from '../../types';
import { extractVersionFromPattern } from '../../utils/version-pattern';
import { BaseEcosystemHandler } from '../base';
import { CargoTomlParser, inspectCargoToml } from './parser';
import { CratesIoRegistryClient } from './registry';

function isWithinRoot(filePath: string, rootDirectory: string): boolean {
  const relativePath = path.relative(rootDirectory, filePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function createFileSystemManifestSource(): PackageManifestSource {
  return {
    async readFile(filePath: string) {
      try {
        return await readFile(filePath, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return undefined;
        }
        throw error;
      }
    },
  };
}

async function resolveWorkspaceVersion(
  filePath: string,
  content: string,
  manifestSource: PackageManifestSource,
): Promise<string> {
  const packageManifest = inspectCargoToml(content);
  const explicitWorkspacePath = packageManifest.workspacePath;

  if (explicitWorkspacePath) {
    const workspaceManifestPath = path.resolve(path.dirname(filePath), explicitWorkspacePath, 'Cargo.toml');
    if (manifestSource.rootDirectory && !isWithinRoot(workspaceManifestPath, manifestSource.rootDirectory)) {
      throw new Error(`Cargo workspace manifest "${workspaceManifestPath}" must be inside "${manifestSource.rootDirectory}".`);
    }

    const workspaceContent = path.resolve(workspaceManifestPath) === path.resolve(filePath)
      ? content
      : await manifestSource.readFile(workspaceManifestPath);
    if (workspaceContent === undefined) {
      throw new Error(`Unable to read Cargo workspace manifest "${workspaceManifestPath}".`);
    }

    const workspaceManifest = inspectCargoToml(workspaceContent);
    if (!workspaceManifest.definesWorkspace) {
      throw new Error(`Cargo workspace manifest "${workspaceManifestPath}" is missing [workspace].`);
    }
    if (!workspaceManifest.workspaceVersion) {
      throw new Error(`Cargo workspace manifest "${workspaceManifestPath}" is missing [workspace.package].version.`);
    }
    return workspaceManifest.workspaceVersion;
  }

  let currentDirectory = path.dirname(filePath);
  while (true) {
    if (manifestSource.rootDirectory && !isWithinRoot(currentDirectory, manifestSource.rootDirectory)) {
      break;
    }

    const candidatePath = path.join(currentDirectory, 'Cargo.toml');
    const candidateContent = path.resolve(candidatePath) === path.resolve(filePath)
      ? content
      : await manifestSource.readFile(candidatePath);
    if (candidateContent !== undefined) {
      const candidateManifest = inspectCargoToml(candidateContent);
      if (candidateManifest.definesWorkspace) {
        if (!candidateManifest.workspaceVersion) {
          throw new Error(`Cargo workspace manifest "${candidatePath}" is missing [workspace.package].version.`);
        }
        return candidateManifest.workspaceVersion;
      }
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }
    currentDirectory = parentDirectory;
  }

  throw new Error(`Unable to find a Cargo workspace for "${filePath}" while resolving [package].version.workspace.`);
}

export class CargoEcosystem extends BaseEcosystemHandler {
  private readonly parser = new CargoTomlParser();
  private readonly registryClient = new CratesIoRegistryClient();

  constructor() {
    super('crates-io', ['cargo.toml']);
  }

  protected parseFromFile(filePath: string, content: string) {
    return this.parser.parse(filePath, content);
  }

  override async parseLocalPackageContent(
    filePath: string,
    content: string,
    versionPattern?: string,
    manifestSource: PackageManifestSource = createFileSystemManifestSource(),
  ): Promise<LocalPackage> {
    const manifest = inspectCargoToml(content);
    if (!manifest.packageName) {
      throw new Error('Cargo.toml is missing [package].name.');
    }

    if (versionPattern) {
      return new LocalPackage(
        new PackageName(manifest.packageName),
        new Version(extractVersionFromPattern(content, versionPattern)),
      );
    }

    if (manifest.packageVersion) {
      return new LocalPackage(new PackageName(manifest.packageName), new Version(manifest.packageVersion));
    }

    if (manifest.inheritsWorkspaceVersion) {
      const workspaceVersion = await resolveWorkspaceVersion(filePath, content, manifestSource);
      return new LocalPackage(new PackageName(manifest.packageName), new Version(workspaceVersion));
    }

    throw new Error('Cargo.toml is missing [package].version. If the crate version is generated, pass "version-pattern".');
  }

  protected async fetchPublishedVersionInternal(packageName: string, options: FetchJsonOptions = {}): Promise<string> {
    const result = await this.registryClient.fetchPublishedVersion(new PackageName(packageName), options);
    return result.toString();
  }
}
