import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PackageParser } from '../../contracts/package-parser';
import { LocalPackageCandidate } from '../../domain/value-objects/local-package-candidate';
import { PackageName } from '../../domain/value-objects/package-name';
import { Version } from '../../domain/value-objects/version';
import { parseProperties } from './properties';

function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function readQuotedValue(value: string): string | undefined {
  const match = value.match(/^["']([^"']+)["']/);
  return match?.[1]?.trim();
}

function resolveGradleValue(rawValue: string | undefined, variables: Record<string, string>): string | undefined {
  if (!rawValue) {
    return undefined;
  }

  const trimmed = rawValue.trim();
  const quoted = readQuotedValue(trimmed);
  if (quoted) {
    return quoted;
  }

  const propertyAccess = trimmed.match(/^(?:project\.)?(?:findProperty|property)\(["']([^"']+)["']\)$/);
  if (propertyAccess) {
    return variables[propertyAccess[1]];
  }

  const simpleIdentifier = trimmed.match(/^[A-Za-z_][A-Za-z0-9_.-]*$/);
  if (simpleIdentifier) {
    const key = simpleIdentifier[0];
    return variables[key] ?? variables[key.replace(/^project\./, '')];
  }

  return undefined;
}

function collectAssignments(content: string, variables: Record<string, string>): Map<string, string> {
  const assignments = new Map<string, string>();
  const patterns = [
    /^\s*(group|version|archivesBaseName)\s*=\s*(.+)$/gm,
    /^\s*set(Group|Version|ArchivesBaseName)\((.+)\)\s*$/gm,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const rawKey = match[1];
      const key = rawKey[0].toLowerCase() + rawKey.slice(1);
      const resolved = resolveGradleValue(match[2], variables);
      if (resolved) {
        assignments.set(key, resolved);
      }
    }
  }

  const archivesNameBlockMatch = content.match(/base\s*\{[\s\S]*?archivesName\s*=\s*(.+?)\r?\n[\s\S]*?\}/m);
  if (archivesNameBlockMatch) {
    const archivesName = resolveGradleValue(archivesNameBlockMatch[1], variables);
    if (archivesName) {
      assignments.set('archivesBaseName', archivesName);
    }
  }

  return assignments;
}

async function detectGradleProjectName(filePath: string): Promise<string> {
  const projectDirectory = path.dirname(filePath);
  const candidates = ['settings.gradle', 'settings.gradle.kts'];

  for (const candidate of candidates) {
    try {
      const content = await readFile(path.join(projectDirectory, candidate), 'utf8');
      const match = content.match(/rootProject\.name\s*=\s*["']([^"']+)["']/);
      if (match?.[1]?.trim()) {
        return match[1].trim();
      }
    } catch {
      continue;
    }
  }

  return path.basename(projectDirectory);
}

export class GradleBuildParser implements PackageParser {
  async parse(filePath: string, content: string): Promise<LocalPackageCandidate> {
    const strippedContent = stripComments(content);
    const projectDirectory = path.dirname(filePath);

    let properties: Record<string, string> = {};
    try {
      properties = parseProperties(await readFile(path.join(projectDirectory, 'gradle.properties'), 'utf8'));
    } catch {
      properties = {};
    }

    const assignments = collectAssignments(strippedContent, properties);
    const groupId = assignments.get('group');
    const version = assignments.get('version');
    const artifactId = assignments.get('archivesBaseName') ?? await detectGradleProjectName(filePath);

    if (!groupId) {
      throw new Error('build.gradle is missing a static or gradle.properties-backed "group" value.');
    }
    if (!version) {
      throw new Error('build.gradle is missing a static or gradle.properties-backed "version" value.');
    }
    if (!artifactId) {
      throw new Error('Unable to determine the Gradle artifact name. Set archivesBaseName, rootProject.name, or pass "package-name".');
    }

    return new LocalPackageCandidate(
      new PackageName(`${groupId}:${artifactId}`),
      new Version(version),
    );
  }
}

export async function parseGradleBuildFile(filePath: string) {
  const content = await readFile(filePath, 'utf8');
  const parsed = await new GradleBuildParser().parse(filePath, content);
  return {
    packageName: parsed.packageName.value,
    version: parsed.version?.value,
  };
}
