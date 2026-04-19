import { PackageName } from '../../domain/value-objects/package-name';
import type { FetchJsonOptions } from '../../types';
import { BaseEcosystemHandler } from '../base';
import { CargoTomlParser } from './parser';
import { CratesIoRegistryClient } from './registry';

export class CargoEcosystem extends BaseEcosystemHandler {
  private readonly parser = new CargoTomlParser();
  private readonly registryClient = new CratesIoRegistryClient();

  constructor() {
    super('crates-io', ['cargo.toml']);
  }

  protected parseFromFile(filePath: string, content: string) {
    return this.parser.parse(filePath, content);
  }

  protected async fetchPublishedVersionInternal(packageName: string, options: FetchJsonOptions = {}): Promise<string> {
    const result = await this.registryClient.fetchPublishedVersion(new PackageName(packageName), options);
    return result.toString();
  }
}
