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
          if (retries > 1) {
            useRedis = false;
            activeCache = new InMemoryCache();
            client.disconnect().catch(() => {});
            return false; // stop retries
          }
          return 500;
        }
      }
    });

    let hasFallbackLogged = false;
    const handleFallback = (errMessage?: string) => {
      useRedis = false;
      activeCache = new InMemoryCache();
      if (!hasFallbackLogged) {
        hasFallbackLogged = true;
        console.log(`[VoxSync Cache] Live cache endpoint not reachable (${errMessage || 'connection standby'}). Engaging standalone high-fidelity cache.`);
      }
      client.disconnect().catch(() => {});
    };

    client.on('error', (err) => {
      handleFallback(err.message);
    });

    client.on('connect', () => {
      // Connect pending
    });

    client.on('ready', () => {
      console.log('[VoxSync Cache] Redis active live cache socket mapped perfectly.');
      useRedis = true;
      activeCache = {
        get: async (key) => {
          try {
            return await client.get(key);
          } catch (e) {
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
            // ignore
          }
        },
        del: async (key) => {
          try {
            await client.del(key);
          } catch (e) {
            // ignore
          }
        },
        flush: async () => {
          try {
            await client.flushAll();
          } catch (e) {
            // ignore
          }
        }
      };
    });

    client.connect().catch((connectErr) => {
      handleFallback(connectErr.message);
    });

  } catch (error: any) {
    useRedis = false;
    activeCache = new InMemoryCache();
    console.log(`[VoxSync Cache] Redis initialization bypassed: ${error.message || error}. Standby in-memory cache activated.`);
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
