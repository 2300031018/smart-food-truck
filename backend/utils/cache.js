const { createClient } = require('redis');

let client;
let ready = false;

function getRedisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = process.env.REDIS_PORT || '6379';
  return `redis://${host}:${port}`;
}

async function initCache() {
  if (process.env.REDIS_DISABLED === 'true') return null;
  if (client) return client;
  const url = getRedisUrl();
  client = createClient({ url });
  client.on('error', (err) => {
    ready = false;
    console.warn('[Redis] error', err.message);
  });
  client.on('ready', () => {
    ready = true;
    console.log('[Redis] connected');
  });
  try {
    await client.connect();
    return client;
  } catch (err) {
    ready = false;
    console.warn('[Redis] connection failed', err.message);
    return null;
  }
}

async function cacheGet(key) {
  if (!client || !ready) return null;
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

async function cacheSet(key, data, ttlSeconds) {
  if (!client || !ready) return;
  const ttl = Number(ttlSeconds || process.env.CACHE_TTL_SECONDS || 60);
  try {
    await client.set(key, JSON.stringify(data), { EX: ttl });
  } catch {}
}

async function cacheDel(keys) {
  if (!client || !ready) return;
  const list = Array.isArray(keys) ? keys : [keys];
  try {
    await client.del(list);
  } catch {}
}

async function cacheDelByPrefix(prefix) {
  if (!client || !ready) return;
  const match = `${prefix}*`;
  const batch = [];
  try {
    for await (const key of client.scanIterator({ MATCH: match, COUNT: 100 })) {
      batch.push(key);
      if (batch.length >= 200) {
        await client.del(batch);
        batch.length = 0;
      }
    }
    if (batch.length) await client.del(batch);
  } catch {}
}

module.exports = { initCache, cacheGet, cacheSet, cacheDel, cacheDelByPrefix };
