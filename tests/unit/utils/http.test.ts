import { describe, expect, it, vi } from 'vitest';
import { fetchJsonWithRetry } from '../../../src/utils/http';

describe('fetchJsonWithRetry', () => {
  it('aborts a stalled request at the configured total timeout', async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }

      signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    })) as unknown as typeof fetch;

    await expect(fetchJsonWithRetry('https://registry.example.test/package', { fetchImpl, timeoutMs: 1 })).rejects.toThrow(
      'Request timed out after 1ms.',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('shares the timeout with a retry after a transient server error', async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      if (fetchImpl.mock.calls.length === 1) {
        return Promise.resolve({ ok: false, status: 503, statusText: 'Service Unavailable' } as Response);
      }

      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }

        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }) as unknown as typeof fetch;

    await expect(fetchJsonWithRetry('https://registry.example.test/package', { fetchImpl, timeoutMs: 10 })).rejects.toThrow(
      'Request timed out after 10ms.',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
