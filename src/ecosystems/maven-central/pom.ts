import type { PackageParser } from '../../contracts/package-parser';
import { LocalPackageCandidate } from '../../domain/value-objects/local-package-candidate';
import { PackageName } from '../../domain/value-objects/package-name';
import { Version } from '../../domain/value-objects/version';
import { getChild, getChildText, parseXml, type XmlNode } from './xml';

function collectProperties(projectNode: XmlNode): Record<string, string> {
  const propertiesNode = getChild(projectNode, 'properties');
  const properties: Record<string, string> = {};

  if (!propertiesNode) {
    return properties;
  }

  for (const child of propertiesNode.children) {
    if (child.text.trim()) {
      properties[child.name] = child.text.trim();
    }
  }

  return properties;
}

function resolvePlaceholders(value: string | undefined, properties: Record<string, string>): string | undefined {
  if (!value) {
    return undefined;
  }

  let resolved = value;

  for (let index = 0; index < 10; index += 1) {
    const next = resolved.replace(/\$\{([^}]+)\}/g, (_, propertyName: string) => properties[propertyName] ?? `\${${propertyName}}`);
    if (next === resolved) {
      break;
    }
    resolved = next;
  }

  return resolved;
}

export class PomXmlParser implements PackageParser {
  parse(_filePath: string, content: string): LocalPackageCandidate {
    const document = parseXml(content);
    if (document.name !== 'project') {
      throw new Error('pom.xml must have <project> as the root element.');
    }

    const parentNode = getChild(document, 'parent');
    const projectArtifactId = getChildText(document, 'artifactId');
    const parentGroupId = getChildText(parentNode ?? document, 'groupId');
    const parentVersion = getChildText(parentNode ?? document, 'version');
    const projectGroupId = getChildText(document, 'groupId') ?? parentGroupId;
    const projectVersion = getChildText(document, 'version') ?? parentVersion;
    const properties = collectProperties(document);

    if (parentGroupId) {
      properties['parent.groupId'] = parentGroupId;
    }
    if (parentVersion) {
      properties['parent.version'] = parentVersion;
    }
    if (projectGroupId) {
      properties['project.groupId'] = projectGroupId;
      properties['groupId'] = projectGroupId;
    }
    if (projectArtifactId) {
      properties['project.artifactId'] = projectArtifactId;
      properties['artifactId'] = projectArtifactId;
    }
    if (projectVersion) {
      properties['project.version'] = projectVersion;
      properties['version'] = projectVersion;
    }

    const groupId = resolvePlaceholders(projectGroupId, properties)?.trim();
    const artifactId = resolvePlaceholders(projectArtifactId, properties)?.trim();
    const version = resolvePlaceholders(projectVersion, properties)?.trim();

    if (!groupId) {
      throw new Error('pom.xml is missing a resolvable <groupId>.');
    }
    if (!artifactId) {
      throw new Error('pom.xml is missing a resolvable <artifactId>.');
    }
    if (!version) {
      throw new Error('pom.xml is missing a resolvable <version>.');
    }

    return new LocalPackageCandidate(
      new PackageName(`${groupId}:${artifactId}`),
      new Version(version),
    );
  }
}

export function parsePomXml(content: string) {
  const parsed = new PomXmlParser().parse('pom.xml', content);
  return {
    packageName: parsed.packageName.value,
    version: parsed.version?.value,
  };
}
