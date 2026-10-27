export interface OciCredentials {
  username: string;
  token: string;
}

export interface OciManifestReference {
  digest: string;
}

export interface OciManifestLookupOptions {
  credentials?: OciCredentials;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  userAgent?: string;
}

export interface OciRegistryClient {
  findManifest(
    repository: string,
    tag: string,
    options?: OciManifestLookupOptions,
  ): Promise<OciManifestReference | null>;
}
