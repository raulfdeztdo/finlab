import { OHLCV, Timeframe, CacheEntry } from '@/lib/types';
import { MIN_CANDLES, API_OUTPUT_SIZE } from '@/lib/config/indicators';

// ============================================
// TwelveData API Client
// ============================================

const BASE_URL = 'https://api.twelvedata.com';
const API_KEY = process.env.TWELVEDATA_API_KEY || '';

// In-memory cache
const cache = new Map<string, CacheEntry<OHLCV[]>>();

// Rate limiting: TwelveData free tier allows 8 req/min (peak), ~8 req/min (average).
// We stay well below: max 5 requests per rolling 60s window.
let requestTimestamps: number[] = [];
const MAX_REQUESTS_PER_MINUTE = 5;

// Mutex: prevents two fetchAllTimeframes cycles from running concurrently
let fetchLock: Promise<void> | null = null;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  // Remove timestamps older than 60 seconds
  requestTimestamps = requestTimestamps.filter(ts => now - ts < 60000);

  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldestInWindow = requestTimestamps[0];
    const waitTime = 60000 - (now - oldestInWindow) + 1000; // +1s buffer
    console.log(`[TwelveData] Rate limit: waiting ${waitTime}ms (${requestTimestamps.length} reqs in window)`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    // Clean again after waiting
    requestTimestamps = requestTimestamps.filter(ts => Date.now() - ts < 60000);
  }

  requestTimestamps.push(Date.now());
}

function getCacheKey(symbol: string, timeframe: Timeframe): string {
  return `${symbol}_${timeframe}`;
}

function getCacheTTL(): number {
  // Cache for 25 minutes (just under the 30-min refresh interval)
  return 25 * 60 * 1000;
}

export function getCachedData(symbol: string, timeframe: Timeframe): OHLCV[] | null {
  const key = getCacheKey(symbol, timeframe);
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCachedData(symbol: string, timeframe: Timeframe, data: OHLCV[]): void {
  const key = getCacheKey(symbol, timeframe);
  cache.set(key, {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + getCacheTTL(),
  });
}

export function getLastCacheTimestamp(symbol: string): string | null {
  // Find the most recent cache entry for this symbol
  let latest = 0;
  for (const [key, entry] of cache.entries()) {
    if (key.startsWith(symbol) && entry.timestamp > latest) {
      latest = entry.timestamp;
    }
  }
  return latest > 0 ? new Date(latest).toISOString() : null;
}

export function clearCache(symbol?: string): void {
  if (symbol) {
    for (const key of cache.keys()) {
      if (key.startsWith(symbol)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

// --- Filter weekend candles (forex market closed Sat-Sun) ---
// Forex: closes Friday ~22:00 UTC, opens Sunday ~22:00 UTC
// All candles in that window are broker noise, not real market data.
function filterWeekendCandles(candles: OHLCV[]): OHLCV[] {
  return candles.filter(c => {
    const d = new Date(c.datetime.includes('T') ? c.datetime : c.datetime.replace(' ', 'T') + 'Z');
    const day = d.getUTCDay();  // 0=Sun, 6=Sat
    const hour = d.getUTCHours();
    if (day === 6) return false;                     // Saturday → filter
    if (day === 0 && hour < 22) return false;        // Sunday before 22:00 UTC → filter
    if (day === 5 && hour >= 22) return false;       // Friday after 22:00 UTC → filter
    return true;
  });
}

// --- Fetch OHLCV from TwelveData ---
export async function fetchOHLCV(
  symbol: string,
  timeframe: Timeframe,
  forceRefresh = false
): Promise<OHLCV[]> {
  // Check cache first (skip only if forceRefresh AND cache is older than 5 min)
  const existingCache = getCachedData(symbol, timeframe);
  if (!forceRefresh && existingCache) {
    console.log(`[TwelveData] Cache hit: ${symbol} ${timeframe}`);
    return existingCache;
  }
  // On forceRefresh: if the cache is very fresh (< 5 min old), skip the API call
  // This prevents hammering the API when multiple requests arrive simultaneously
  if (forceRefresh && existingCache) {
    const cacheEntry = cache.get(getCacheKey(symbol, timeframe));
    const ageMs = cacheEntry ? Date.now() - cacheEntry.timestamp : Infinity;
    if (ageMs < 5 * 60 * 1000) {
      console.log(`[TwelveData] Cache fresh enough (${Math.round(ageMs / 1000)}s old), skipping API call for ${symbol} ${timeframe}`);
      return existingCache;
    }
  }

  await waitForRateLimit();

  // Request more candles than needed so after weekend filtering we still have enough
  const outputSize = API_OUTPUT_SIZE[timeframe];
  const url = `${BASE_URL}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${timeframe}&outputsize=${outputSize}&apikey=${API_KEY}&format=JSON`;

  console.log(`[TwelveData] Fetching: ${symbol} ${timeframe}`);

  const response = await fetch(url, {
    next: { revalidate: 0 }, // No Next.js cache
  });

  if (!response.ok) {
    throw new Error(`TwelveData API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.status === 'error') {
    throw new Error(`TwelveData error: ${data.message}`);
  }

  if (!data.values || !Array.isArray(data.values)) {
    throw new Error('TwelveData returned no values');
  }

  // Parse and sort chronologically (oldest first)
  const rawCandles: OHLCV[] = data.values
    .map((v: { datetime: string; open: string; high: string; low: string; close: string; volume: string }) => ({
      datetime: v.datetime,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseFloat(v.volume || '0'),
    }))
    .reverse(); // TwelveData returns newest first, we want oldest first

  // Filter out weekend noise and keep only real market candles
  const filtered = filterWeekendCandles(rawCandles);

  // Keep at most MIN_CANDLES from the end (most recent real-market data)
  const minRequired = MIN_CANDLES[timeframe];
  const candles = filtered.length > minRequired
    ? filtered.slice(-minRequired)
    : filtered;

  // Cache the result
  setCachedData(symbol, timeframe, candles);

  console.log(`[TwelveData] Fetched ${rawCandles.length} raw → ${filtered.length} filtered → ${candles.length} final candles for ${symbol} ${timeframe}`);
  return candles;
}

// --- Fetch all timeframes for a symbol ---
// Uses a mutex so only one fetch cycle runs at a time. If a second call arrives
// while a cycle is in progress, it waits for the first one and then returns
// cached data (which the first cycle just populated).
// Symbol used by the currently-running fetch cycle (needed by waiters to read the right cache keys)
let activeFetchSymbol: string | null = null;

export async function fetchAllTimeframes(
  symbol: string,
  forceRefresh = false
): Promise<Record<Timeframe, OHLCV[]>> {
  const timeframes: Timeframe[] = ['5min', '15min', '30min', '1h', '4h'];

  // If another fetch cycle is already running, wait for it and return its cache
  if (fetchLock) {
    console.log(`[TwelveData] Fetch cycle already in progress, waiting...`);
    const symbolToRead = activeFetchSymbol || symbol;
    await fetchLock;
    // The previous cycle has fully populated the cache — read it now
    const cached: Partial<Record<Timeframe, OHLCV[]>> = {};
    for (const tf of timeframes) {
      const data = getCachedData(symbolToRead, tf);
      if (data && data.length > 0) {
        cached[tf] = data;
      } else {
        // Fallback: also try with the requested symbol key (in case keys differ)
        cached[tf] = getCachedData(symbol, tf) || [];
      }
    }
    console.log(`[TwelveData] Waiter resolved — 5min: ${cached['5min']?.length ?? 0} candles from cache`);
    return cached as Record<Timeframe, OHLCV[]>;
  }

  // Acquire lock and record which symbol is being fetched
  let releaseLock: () => void;
  fetchLock = new Promise<void>(resolve => { releaseLock = resolve; });
  activeFetchSymbol = symbol;

  const result: Partial<Record<Timeframe, OHLCV[]>> = {};

  try {
    // Fetch sequentially with generous delay to stay under rate limits.
    // 5 requests with 10s gaps = ~50s total, well within 60s/8-req window.
    for (let i = 0; i < timeframes.length; i++) {
      const tf = timeframes[i];
      try {
        result[tf] = await fetchOHLCV(symbol, tf, forceRefresh);
      } catch (error) {
        console.error(`[TwelveData] Error fetching ${symbol} ${tf}:`, error);
        // Always fall back to cache — never return empty array for a TF
        const stale = getCachedData(symbol, tf);
        if (stale && stale.length > 0) {
          console.log(`[TwelveData] Using stale cache for ${symbol} ${tf} (${stale.length} candles)`);
          result[tf] = stale;
        } else {
          console.warn(`[TwelveData] No cache available for ${symbol} ${tf} — returning empty`);
          result[tf] = [];
        }
      }
      // Wait 10s between requests (except after the last one)
      if (i < timeframes.length - 1) {
        console.log(`[TwelveData] Waiting 10s before next request...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  } finally {
    // Release lock AFTER result is fully built
    fetchLock = null;
    activeFetchSymbol = null;
    releaseLock!();
  }

  return result as Record<Timeframe, OHLCV[]>;
}

// --- Get current price from the latest candle ---
export function getCurrentPrice(candles: Record<Timeframe, OHLCV[]>): number {
  // Use the 5min candle as it's the most recent
  const fiveMin = candles['5min'];
  if (fiveMin && fiveMin.length > 0) {
    return fiveMin[fiveMin.length - 1].close;
  }
  // Fallback to 15min
  const fifteenMin = candles['15min'];
  if (fifteenMin && fifteenMin.length > 0) {
    return fifteenMin[fifteenMin.length - 1].close;
  }
  return 0;
}
