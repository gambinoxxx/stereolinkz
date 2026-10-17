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
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1)); // 0.5 s, 1 s, 2 s
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
