import { PackageName } from '../../domain/value-objects/package-name';
import type { FetchJsonOptions } from '../../types';
import { BaseEcosystemHandler } from '../base';
import { VsCodeExtensionParser } from './parser';
import { VsCodeMarketplaceRegistryClient } from './registry';

export class VsCodeMarketplaceEcosystem extends BaseEcosystemHandler {
  private readonly parser = new VsCodeExtensionParser();
  private readonly registryClient = new VsCodeMarketplaceRegistryClient();

  constructor() {
    super('vscode-marketplace', ['package.json']);
  }

  protected parseFromFile(filePath: string, content: string) {
    return this.parser.parse(filePath, content);
  }

  protected async fetchPublishedVersionInternal(packageName: string, options: FetchJsonOptions = {}): Promise<string> {
    const result = await this.registryClient.fetchPublishedVersion(new PackageName(packageName), options);
    return result.toString();
  }
}
