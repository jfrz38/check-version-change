import path from 'node:path';
import { PackageName } from '../../domain/value-objects/package-name';
import type { FetchJsonOptions } from '../../types';
import { BaseEcosystemHandler } from '../base';
import { GradleBuildParser } from './gradle';
import { PomXmlParser } from './pom';
import { MavenCentralRegistryClient } from './registry';

export class MavenCentralEcosystem extends BaseEcosystemHandler {
  private readonly gradleParser = new GradleBuildParser();
  private readonly pomParser = new PomXmlParser();
  private readonly registryClient = new MavenCentralRegistryClient();

  constructor() {
    super('maven-central', ['pom.xml', 'build.gradle', 'build.gradle.kts']);
  }

  protected parseFromFile(filePath: string, content: string) {
    const fileName = path.basename(filePath).toLowerCase();
    if (fileName === 'pom.xml') {
      return this.pomParser.parse(filePath, content);
    }
    return this.gradleParser.parse(filePath, content);
  }

  protected async fetchPublishedVersionInternal(packageName: string, options: FetchJsonOptions = {}): Promise<string> {
    const result = await this.registryClient.fetchPublishedVersion(new PackageName(packageName), options);
    return result.toString();
  }
}
