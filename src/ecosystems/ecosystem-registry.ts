import type { EcosystemHandler, FetchJsonOptions, SupportedRegistry } from '../types';
import { CargoEcosystem } from './cargo/ecosystem';
import { GoEcosystem } from './go/ecosystem';
import { MavenCentralEcosystem } from './maven-central/ecosystem';
import { NpmEcosystem } from './npm/ecosystem';
import { PypiEcosystem } from './pypi/ecosystem';

const SUPPORTED_FILE_LIST = 'package.json, pyproject.toml, setup.py, pom.xml, build.gradle, build.gradle.kts, Cargo.toml, and go.mod';

export class EcosystemRegistry {
  private readonly handlers: EcosystemHandler[];

  constructor(handlers: EcosystemHandler[]) {
    this.handlers = handlers;
  }

  detectRegistryFromFile(filePath: string): SupportedRegistry {
    return this.getHandlerForFile(filePath).registry;
  }

  parseLocalPackageFile(filePath: string, versionPattern?: string) {
    return this.getHandlerForFile(filePath).parseLocalPackage(filePath, versionPattern);
  }

  parseLocalPackageContent(filePath: string, content: string, versionPattern?: string) {
    return this.getHandlerForFile(filePath).parseLocalPackageContent(filePath, content, versionPattern);
  }

  fetchPublishedVersion(registry: SupportedRegistry, packageName: string, options?: FetchJsonOptions): Promise<string> {
    return this.getHandlerForRegistry(registry).fetchPublishedVersion(packageName, options);
  }

  private getHandlerForFile(filePath: string): EcosystemHandler {
    const handler = this.handlers.find((candidate) => candidate.supports(filePath));
    if (!handler) {
      throw new Error(`Unable to detect a registry from "${filePath}". Supported files are ${SUPPORTED_FILE_LIST}.`);
    }
    return handler;
  }

  private getHandlerForRegistry(registry: SupportedRegistry): EcosystemHandler {
    const handler = this.handlers.find((candidate) => candidate.registry === registry);
    if (!handler) {
      throw new Error(`Unsupported registry "${registry}".`);
    }
    return handler;
  }
}

export const ecosystemRegistry = new EcosystemRegistry([
  new NpmEcosystem(),
  new PypiEcosystem(),
  new MavenCentralEcosystem(),
  new CargoEcosystem(),
  new GoEcosystem(),
]);

export function detectRegistryFromFile(filePath: string): SupportedRegistry {
  return ecosystemRegistry.detectRegistryFromFile(filePath);
}

export function parseLocalPackageFile(filePath: string, versionPattern?: string) {
  return ecosystemRegistry.parseLocalPackageFile(filePath, versionPattern);
}

export function parseLocalPackageContent(filePath: string, content: string, versionPattern?: string) {
  return ecosystemRegistry.parseLocalPackageContent(filePath, content, versionPattern);
}
