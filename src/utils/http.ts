import type { FetchJsonOptions } from '../types';

const DEFAULT_TIMEOUT_MS = 10000;

interface JsonResult<T> {
  found: boolean;
  data: T | null;
}

export async function fetchJsonWithRetry<T>(url: string, options: FetchJsonOptions = {}): Promise<JsonResult<T>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const missingStatusCodes = new Set(options.missingStatusCodes ?? [404]);
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms.`));
  }, timeoutMs);

  let lastError: unknown;

  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          headers: {
            accept: 'application/json',
            ...options.headers,
          },
          signal: controller.signal,
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
        if (attempt === 2 || controller.signal.aborted) {
          break;
        }
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  const suffix = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Unable to fetch registry metadata from ${url}: ${suffix}`);
}
