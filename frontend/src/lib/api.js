import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const responseCache = new Map();

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

function buildCacheKey(path, params = {}) {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right));
  const search = new URLSearchParams(entries).toString();
  return search ? `${path}?${search}` : path;
}

export async function cachedGet(path, { params, ttl = 60_000 } = {}) {
  const cacheKey = buildCacheKey(path, params);
  const cached = responseCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < ttl) {
    return cached.data;
  }

  try {
    const { data } = await api.get(path, { params });
    responseCache.set(cacheKey, { data, timestamp: now });
    return data;
  } catch (error) {
    if (cached) {
      return cached.data;
    }
    throw error;
  }
}

export function invalidateCachedGet(pathPrefix) {
  for (const key of responseCache.keys()) {
    if (key.startsWith(pathPrefix)) {
      responseCache.delete(key);
    }
  }
}

export function getWeather(region) {
  return cachedGet("/weather", {
    params: { region },
    ttl: 5 * 60_000,
  });
}

export function getMarketPrices() {
  return cachedGet("/market/prices", {
    ttl: 5 * 60_000,
  });
}

export function getChatHistory(sessionId) {
  return cachedGet(`/chat/${sessionId}`, {
    ttl: 30_000,
  });
}
