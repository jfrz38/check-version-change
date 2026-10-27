import * as github from '@actions/github';
import { ociRegistryClient } from '../oci/registry-client';
import type { CompareVersionRequest } from './compare-version-request';

export interface ResolvedOciTagExistence {
  exists: boolean;
  manifestDigest: string;
  reference: string;
}

function resolveTag(pattern: string, version: string): string {
  if (!pattern.includes('{version}')) {
    throw new Error('The "oci-tag-pattern" input must contain "{version}".');
  }
  return pattern.replaceAll('{version}', version);
}

export async function resolveOciTagExistence(
  request: CompareVersionRequest,
  localVersion: string,
): Promise<ResolvedOciTagExistence> {
  const tag = resolveTag(request.ociTagPattern, localVersion);
  const credentials = request.ociToken
    ? { username: request.ociUsername, token: request.ociToken }
    : undefined;
  const reference = `${request.ociRepository}:${tag}`;
  const manifest = await ociRegistryClient.findManifest(request.ociRepository, tag, {
    credentials,
    userAgent: `check-version-change/${github.context.runId || 'local'}`,
  });

  return {
    exists: manifest !== null,
    manifestDigest: manifest?.digest ?? '',
    reference,
  };
}
