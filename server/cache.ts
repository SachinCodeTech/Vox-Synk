import { createClient } from 'redis';

// ==========================================================
// REDIS LIVE CACHE CONTROLLER WITH RUNTIME STANDBY FALLBACK
// ==========================================================

interface CacheEngine {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, seconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  flush(): Promise<void>;
}

// In-memory key-value cache fallback
class InMemoryCache implements CacheEngine {
  private store = new Map<string, { val: string; expires?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expires && entry.expires < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.val;
  }

  async set(key: string, value: string, seconds?: number): Promise<void> {
    const expires = seconds ? Date.now() + seconds * 1000 : undefined;
    this.store.set(key, { val: value, expires });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async flush(): Promise<void> {
    this.store.clear();
  }
}

let activeCache: CacheEngine = new InMemoryCache();
let useRedis = false;

const redisUrl = process.env.REDIS_URL || process.env.REDISURI;
if (redisUrl || (process.env.REDISHOST && process.env.REDISPORT)) {
  try {
    const client = createClient({
      url: redisUrl || `redis://${process.env.REDISHOST || 'localhost'}:${process.env.REDISPORT || 6379}`,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.warn('[VoxSync Cache] Redis reconnect threshold achieved. Moving cache engine to local fallback.');
            useRedis = false;
            activeCache = new InMemoryCache();
            return false; // stop retries
          }
          return Math.min(retries * 500, 2000);
        }
      }
    });

    client.on('error', (err) => {
      console.warn(`[VoxSync Cache] Redis Client Connection Issue: ${err.message}. Running local in-memory fallback cache.`);
      useRedis = false;
      activeCache = new InMemoryCache();
    });

    client.on('connect', () => {
      console.log('[VoxSync Cache] Connecting to Redis endpoint...');
    });

    client.on('ready', () => {
      console.log('[VoxSync Cache] Redis active live cache socket mapped perfectly.');
      useRedis = true;
      activeCache = {
        get: async (key) => {
          try {
            return await client.get(key);
          } catch (e) {
            console.error('[VoxSync Cache] Redis GET failed:', e);
            return null;
          }
        },
        set: async (key, value, seconds) => {
          try {
            if (seconds) {
              await client.setEx(key, seconds, value);
            } else {
              await client.set(key, value);
            }
          } catch (e) {
            console.error('[VoxSync Cache] Redis SET failed:', e);
          }
        },
        del: async (key) => {
          try {
            await client.del(key);
          } catch (e) {
            console.error('[VoxSync Cache] Redis DEL failed:', e);
          }
        },
        flush: async () => {
          try {
            await client.flushAll();
          } catch (e) {
            console.error('[VoxSync Cache] Redis FLUSH failed:', e);
          }
        }
      };
    });

    client.connect().catch((connectErr) => {
      console.warn(`[VoxSync Cache] Redis client failed to execute connect command: ${connectErr.message}. Standing by with local cache.`);
    });

  } catch (error) {
    console.warn('[VoxSync Cache] Caught setup error on Redis client initialization. Standing by with in-memory fallback:', error);
  }
} else {
  console.log('[VoxSync Cache] No Redis host parameters discovered in env. Operating standalone in-memory cache.');
}

export const cache = {
  get: (key: string) => activeCache.get(key),
  set: (key: string, value: string, seconds?: number) => activeCache.set(key, value, seconds),
  del: (key: string) => activeCache.del(key),
  flush: () => activeCache.flush(),
  isUsingRedis: () => useRedis
};
