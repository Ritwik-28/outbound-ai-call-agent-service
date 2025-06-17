import { createClient } from 'redis';
import { logger } from '../utils/logger.js';

// Initialize Redis client with fallback
let redisClient = null;
let redisConnected = false;

try {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  redisClient.on('error', (err) => {
    logger.error('Redis Client Error', err);
    redisConnected = false;
  });
  
  redisClient.on('connect', () => {
    logger.info('Redis Client Connected');
    redisConnected = true;
  });

  // Connect to Redis
  await redisClient.connect();
} catch (error) {
  logger.warn('Redis connection failed, using in-memory fallback', { error: error.message });
  redisConnected = false;
}

// In-memory fallback cache
const memoryCache = new Map();

// Cache TTLs
const TTL = {
  KNOWLEDGE_BASE: 15 * 60, // 15 minutes
  RESPONSE: 5 * 60,        // 5 minutes
  CONVERSATION: 30 * 60    // 30 minutes
};

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any>} Cached value
 */
export async function getCache(key) {
  try {
    if (redisConnected && redisClient) {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } else {
      // Fallback to memory cache
      const value = memoryCache.get(key);
      if (value && Date.now() - value.timestamp < value.ttl * 1000) {
        return value.data;
      }
      return null;
    }
  } catch (error) {
    logger.error('Cache get error', { key, error: error.message });
    return null;
  }
}

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 */
export async function setCache(key, value, ttl) {
  try {
    if (redisConnected && redisClient) {
      await redisClient.set(key, JSON.stringify(value), {
        EX: ttl
      });
    } else {
      // Fallback to memory cache
      memoryCache.set(key, {
        data: value,
        timestamp: Date.now(),
        ttl: ttl
      });
      
      // Clean up old entries
      const now = Date.now();
      for (const [k, v] of memoryCache.entries()) {
        if (now - v.timestamp > v.ttl * 1000) {
          memoryCache.delete(k);
        }
      }
    }
  } catch (error) {
    logger.error('Cache set error', { key, error: error.message });
  }
}

/**
 * Delete value from cache
 * @param {string} key - Cache key
 */
export async function deleteCache(key) {
  try {
    if (redisConnected && redisClient) {
      await redisClient.del(key);
    } else {
      memoryCache.delete(key);
    }
  } catch (error) {
    logger.error('Cache delete error', { key, error: error.message });
  }
}

/**
 * Generate cache key
 * @param {string} prefix - Key prefix
 * @param {string} id - Unique identifier
 * @returns {string} Cache key
 */
export function generateCacheKey(prefix, id) {
  return `${prefix}:${id}`;
}

// Export TTL constants
export { TTL }; 