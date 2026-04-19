import type { FetchJsonOptions } from '../types';

interface JsonResult<T> {
  found: boolean;
  data: T | null;
}

export async function fetchJsonWithRetry<T>(url: string, options: FetchJsonOptions = {}): Promise<JsonResult<T>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const missingStatusCodes = new Set(options.missingStatusCodes ?? [404]);

  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          accept: 'application/json',
          ...options.headers,
        },
      });

      if (missingStatusCodes.has(response.status)) {
        return { found: false, data: null };
      }

      if (response.ok) {
        return {
          found: true,
          data: (await response.json()) as T,
        };
      }

      if (response.status >= 500 && attempt === 1) {
        continue;
      }

      throw new Error(`Request failed with status ${response.status} ${response.statusText}`.trim());
    } catch (error) {
      lastError = error;
      if (attempt === 2) {
        break;
      }
    }
  }

  const suffix = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Unable to fetch registry metadata from ${url}: ${suffix}`);
}
