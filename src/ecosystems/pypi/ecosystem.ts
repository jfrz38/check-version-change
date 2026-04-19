import path from 'node:path';
import { PackageName } from '../../domain/value-objects/package-name';
import type { FetchJsonOptions } from '../../types';
import { BaseEcosystemHandler } from '../base';
import { PyProjectParser } from './pyproject';
import { PypiRegistryClient } from './registry';
import { SetupPyParser } from './setup-py';

export class PypiEcosystem extends BaseEcosystemHandler {
  private readonly pyProjectParser = new PyProjectParser();
  private readonly setupPyParser = new SetupPyParser();
  private readonly registryClient = new PypiRegistryClient();

  constructor() {
    super('pypi', ['pyproject.toml', 'setup.py']);
  }

  protected parseFromFile(filePath: string, content: string) {
    const fileName = path.basename(filePath).toLowerCase();
    if (fileName === 'pyproject.toml') {
      return this.pyProjectParser.parse(filePath, content);
    }
    return this.setupPyParser.parse(filePath, content);
  }

  protected async fetchPublishedVersionInternal(packageName: string, options: FetchJsonOptions = {}): Promise<string> {
    const result = await this.registryClient.fetchPublishedVersion(new PackageName(packageName), options);
    return result.toString();
  }
}
