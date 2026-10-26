import type {
  OciCredentials,
  OciManifestLookupOptions,
  OciManifestReference,
  OciRegistryClient,
} from '../contracts/oci-registry-client';

const DEFAULT_TIMEOUT_MS = 10000;
const OCI_REPOSITORY_PATTERN = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*(?:\/[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*)*$/;
const OCI_TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
const OCI_DIGEST_PATTERN = /^[a-z0-9]+(?:[+._-][a-z0-9]+)*:[A-Za-z0-9=_-]+$/;
const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
].join(', ');

interface ParsedRepository {
  host: string;
  name: string;
}

interface BearerChallenge {
  realm: string;
  service?: string;
  scope?: string;
}

interface TokenResponse {
  token?: string;
  access_token?: string;
}

function parseRepository(repository: string): ParsedRepository {
  const normalized = repository.trim();
  if (!normalized) {
    throw new Error('The "oci-repository" input is required when compare-source is "oci".');
  }
  if (normalized.includes('://') || normalized.includes('@')) {
    throw new Error('The "oci-repository" input must use "registry/namespace/name" format without a scheme, tag, or digest.');
  }

  const separator = normalized.indexOf('/');
  if (separator <= 0 || separator === normalized.length - 1) {
    throw new Error('The "oci-repository" input must include a registry host and repository name.');
  }

  const host = normalized.slice(0, separator);
  const name = normalized.slice(separator + 1);
  if (!host || host.includes('/') || !OCI_REPOSITORY_PATTERN.test(name)) {
    throw new Error(`Invalid OCI repository "${repository}".`);
  }

  try {
    const parsedHost = new URL(`https://${host}`);
    if (parsedHost.host !== host || parsedHost.pathname !== '/') {
      throw new Error();
    }
  } catch {
    throw new Error(`Invalid OCI registry host in "${repository}".`);
  }

  return { host, name };
}

function assertTag(tag: string): void {
  if (!OCI_TAG_PATTERN.test(tag)) {
    throw new Error(`Invalid OCI tag "${tag}".`);
  }
}

function parseBearerChallenge(header: string | null): BearerChallenge {
  if (!header || !/^Bearer\s+/i.test(header)) {
    throw new Error('OCI registry requested authentication without a supported Bearer challenge.');
  }

  const challenge: Partial<BearerChallenge> = {};
  const attributes = header.replace(/^Bearer\s+/i, '');
  const attributePattern = /([A-Za-z][A-Za-z0-9_-]*)="((?:[^"\\]|\\.)*)"/g;
  for (const match of attributes.matchAll(attributePattern)) {
    const value = match[2].replace(/\\(["\\])/g, '$1');
    if (match[1].toLowerCase() === 'realm') challenge.realm = value;
    if (match[1].toLowerCase() === 'service') challenge.service = value;
    if (match[1].toLowerCase() === 'scope') challenge.scope = value;
  }

  if (!challenge.realm) {
    throw new Error('OCI Bearer authentication challenge is missing its realm.');
  }

  let realm: URL;
  try {
    realm = new URL(challenge.realm);
  } catch {
    throw new Error('OCI Bearer authentication challenge contains an invalid realm URL.');
  }
  if (realm.protocol !== 'https:') {
    throw new Error('OCI authentication realm must use HTTPS.');
  }

  return challenge as BearerChallenge;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms.`)), timeoutMs);
    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      if (response.status >= 500 && attempt === 1) {
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === 2 || controller.signal.aborted) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

async function requestBearerToken(
  challenge: BearerChallenge,
  credentials: OciCredentials | undefined,
  options: Required<Pick<OciManifestLookupOptions, 'fetchImpl' | 'timeoutMs'>> & Pick<OciManifestLookupOptions, 'userAgent'>,
): Promise<string> {
  const tokenUrl = new URL(challenge.realm);
  if (challenge.service) tokenUrl.searchParams.set('service', challenge.service);
  if (challenge.scope) tokenUrl.searchParams.set('scope', challenge.scope);
  tokenUrl.searchParams.set('client_id', 'check-version-change');

  const headers: Record<string, string> = {
    accept: 'application/json',
  };
  if (options.userAgent) headers['user-agent'] = options.userAgent;
  if (credentials) {
    headers.authorization = `Basic ${Buffer.from(`${credentials.username}:${credentials.token}`).toString('base64')}`;
  }

  const response = await fetchWithTimeout(options.fetchImpl, tokenUrl.toString(), { headers }, options.timeoutMs);
  if (!response.ok) {
    throw new Error(`OCI authentication failed with status ${response.status} ${response.statusText}`.trim());
  }

  const payload = await response.json() as TokenResponse;
  const token = payload.token || payload.access_token;
  if (!token) {
    throw new Error('OCI authentication response did not contain a Bearer token.');
  }
  return token;
}

function readManifestResult(response: Response): OciManifestReference | null {
  if (response.status === 404) return null;
  if (response.status === 401 || response.status === 403) {
    throw new Error(`OCI registry denied access with status ${response.status} ${response.statusText}`.trim());
  }
  if (!response.ok) {
    throw new Error(`OCI registry request failed with status ${response.status} ${response.statusText}`.trim());
  }

  const digest = response.headers.get('docker-content-digest')?.trim() || '';
  if (!OCI_DIGEST_PATTERN.test(digest)) {
    throw new Error('OCI registry response did not contain a valid Docker-Content-Digest header.');
  }
  return { digest };
}

export class DistributionOciRegistryClient implements OciRegistryClient {
  async findManifest(
    repository: string,
    tag: string,
    options: OciManifestLookupOptions = {},
  ): Promise<OciManifestReference | null> {
    const { host, name } = parseRepository(repository);
    assertTag(tag);
    if (options.credentials && (!options.credentials.username || !options.credentials.token)) {
      throw new Error('OCI credentials require both a username and token.');
    }

    const fetchImpl = options.fetchImpl ?? fetch;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const manifestUrl = `https://${host}/v2/${name}/manifests/${encodeURIComponent(tag)}`;
    const baseHeaders: Record<string, string> = { accept: MANIFEST_ACCEPT };
    if (options.userAgent) baseHeaders['user-agent'] = options.userAgent;

    let response = await fetchWithTimeout(fetchImpl, manifestUrl, {
      method: 'HEAD',
      headers: baseHeaders,
    }, timeoutMs);

    if (response.status === 401) {
      const challenge = parseBearerChallenge(response.headers.get('www-authenticate'));
      const bearerToken = await requestBearerToken(challenge, options.credentials, {
        fetchImpl,
        timeoutMs,
        userAgent: options.userAgent,
      });
      response = await fetchWithTimeout(fetchImpl, manifestUrl, {
        method: 'HEAD',
        headers: {
          ...baseHeaders,
          authorization: `Bearer ${bearerToken}`,
        },
      }, timeoutMs);
    }

    return readManifestResult(response);
  }
}

export const ociRegistryClient = new DistributionOciRegistryClient();
