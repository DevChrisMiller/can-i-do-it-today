import type { Env } from "./index";

// Cache layer. Uses KV if bound, otherwise an in-memory fallback
// scoped to the current isolate (fine for dev and low-traffic prod).

interface MemoEntry {
  value: unknown;
  expiresAt: number;
}

const memo = new Map<string, MemoEntry>();

export async function getCached<T>(env: Env, key: string): Promise<T | null> {
  if (env.WEATHER_CACHE) {
    const raw = await env.WEATHER_CACHE.get(key, "json");
    return (raw as T) ?? null;
  }
  const entry = memo.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memo.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function setCached(
  env: Env,
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (env.WEATHER_CACHE) {
    await env.WEATHER_CACHE.put(key, JSON.stringify(value), {
      expirationTtl: ttlSeconds,
    });
    return;
  }
  memo.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}
