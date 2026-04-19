import { PackageName } from '../../domain/value-objects/package-name';
import type { FetchJsonOptions } from '../../types';
import { BaseEcosystemHandler } from '../base';
import { NpmPackageParser } from './parser';
import { NpmRegistryClient } from './registry';

export class NpmEcosystem extends BaseEcosystemHandler {
  private readonly parser = new NpmPackageParser();
  private readonly registryClient = new NpmRegistryClient();

  constructor() {
    super('npm', ['package.json']);
  }

  protected parseFromFile(filePath: string, content: string) {
    return this.parser.parse(filePath, content);
  }

  protected async fetchPublishedVersionInternal(packageName: string, options: FetchJsonOptions = {}): Promise<string> {
    const result = await this.registryClient.fetchPublishedVersion(new PackageName(packageName), options);
    return result.toString();
  }
}
