const tokenBuckets = new Map<string, { tokens: number; lastRefill: number }>();

/**
 * Simple in-memory token bucket rate limiter.
 * Returns true if the request is allowed, false if rate limited.
 */
export function rateLimit(key: string, maxTokens: number, refillIntervalMs: number): boolean {
  const now = Date.now();
  let bucket = tokenBuckets.get(key);

  if (!bucket) {
    bucket = { tokens: maxTokens - 1, lastRefill: now };
    tokenBuckets.set(key, bucket);
    return true;
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const tokensToAdd = Math.floor(elapsed / refillIntervalMs) * maxTokens;
  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    return false;
  }

  bucket.tokens--;
  return true;
}

/** Clean up stale buckets periodically (every 5 minutes) */
setInterval(
  () => {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    for (const [key, bucket] of tokenBuckets) {
      if (now - bucket.lastRefill > staleThreshold) {
        tokenBuckets.delete(key);
      }
    }
  },
  5 * 60 * 1000
);
