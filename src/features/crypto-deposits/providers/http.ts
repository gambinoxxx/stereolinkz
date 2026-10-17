// JSON over HTTP for the providers: a timeout on every call, and retries
// with exponential backoff on rate limits (429), 5xx and network errors.
import { ProviderError } from "@/features/crypto-deposits/providers/types";

export type Fetch = typeof fetch;

export type HttpOptions = {
  fetchImpl?: Fetch;
  timeoutMs?: number;
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  {
    fetchImpl = fetch,
    timeoutMs = 8000,
    retries = 3,
    sleep = wait,
  }: HttpOptions = {},
): Promise<T> {
  let lastError: ProviderError | null = null;
  let limited = false;
  for (let attempt = 0; attempt <= retries; attempt++) {
    // 0.5 s, 1 s, 2 s; twice that after a rate-limit answer.
    if (attempt > 0) await sleep((limited ? 1000 : 500) * 2 ** (attempt - 1));
    let response: Response;
    try {
      response = await fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch {
      lastError = new ProviderError("Provider unreachable or timed out", true);
      continue;
    }
    limited = response.status === 429 || response.status === 403;
    if (limited && response.status === 403) {
      // TronGrid answers 403 when a key's quota is used up.
      lastError = new ProviderError("Provider quota reached", true);
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      lastError = new ProviderError(
        `Provider answered ${response.status}`,
        true,
      );
      continue;
    }
    if (!response.ok)
      throw new ProviderError(`Provider answered ${response.status}`, false);
    try {
      return (await response.json()) as T;
    } catch {
      throw new ProviderError("Provider sent invalid JSON", false);
    }
  }
  throw lastError ?? new ProviderError("Provider failed", true);
}
