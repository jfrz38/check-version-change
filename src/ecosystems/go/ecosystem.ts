import { PackageName } from '../../domain/value-objects/package-name';
import type { FetchJsonOptions } from '../../types';
import { BaseEcosystemHandler } from '../base';
import { GoModParser } from './parser';
import { GoProxyRegistryClient } from './registry';

export class GoEcosystem extends BaseEcosystemHandler {
  private readonly parser = new GoModParser();
  private readonly registryClient = new GoProxyRegistryClient();

  constructor() {
    super('go-proxy', ['go.mod']);
  }

  protected parseFromFile(filePath: string, content: string) {
    return this.parser.parse(filePath, content);
  }

  protected async fetchPublishedVersionInternal(packageName: string, options: FetchJsonOptions = {}): Promise<string> {
    const result = await this.registryClient.fetchPublishedVersion(new PackageName(packageName), options);
    return result.toString();
  }
}
