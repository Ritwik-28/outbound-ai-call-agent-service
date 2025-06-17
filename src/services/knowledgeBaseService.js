import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';
import { getCache, setCache, generateCacheKey, TTL } from './cacheService.js';

const KNOWLEDGE_BASE_DIR = process.env.KNOWLEDGE_BASE_DIR || path.join(process.cwd(), 'knowledge-base');
const CACHE_PREFIX = 'kb';

// Initialize in-memory cache for frequently accessed chunks
const memoryCache = new Map();
const MEMORY_CACHE_SIZE = 1000; // Maximum number of chunks to keep in memory

/**
 * Preload knowledge base at startup
 */
export async function preloadKnowledgeBase() {
  try {
    logger.info('Preloading knowledge base...');
    
    // Check if knowledge base directory exists
    if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
      logger.warn('Knowledge base directory does not exist, creating empty directory', { 
        path: KNOWLEDGE_BASE_DIR 
      });
      fs.mkdirSync(KNOWLEDGE_BASE_DIR, { recursive: true });
      return;
    }
    
    const chunks = await loadKnowledgeBase();
    
    // Cache in Redis
    await setCache(
      generateCacheKey(CACHE_PREFIX, 'all'),
      chunks,
      TTL.KNOWLEDGE_BASE
    );
    
    // Cache most relevant chunks in memory
    chunks
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, MEMORY_CACHE_SIZE)
      .forEach(chunk => {
        memoryCache.set(chunk.content, chunk);
      });
    
    logger.info('Knowledge base preloaded', {
      totalChunks: chunks.length,
      memoryCachedChunks: memoryCache.size
    });
  } catch (error) {
    logger.error('Failed to preload knowledge base', { error: error.message });
  }
}

/**
 * Load and index knowledge base files
 * @returns {Promise<Array>} Indexed knowledge base chunks
 */
async function loadKnowledgeBase() {
  try {
    // Check Redis cache first
    const cachedChunks = await getCache(generateCacheKey(CACHE_PREFIX, 'all'));
    if (cachedChunks) {
      logger.info('Using cached knowledge base');
      return cachedChunks;
    }

    const chunks = [];
    const files = await getAllFiles(KNOWLEDGE_BASE_DIR, '.txt');
    
    if (files.length === 0) {
      logger.info('No knowledge base files found', { directory: KNOWLEDGE_BASE_DIR });
      return [];
    }
    
    // Process files in parallel using worker threads with fallback
    const workers = files.map(file => {
      return new Promise((resolve, reject) => {
        try {
          const worker = new Worker(`
            const { parentPort } = require('worker_threads');
            const fs = require('fs');
            const path = require('path');

            parentPort.on('message', async (file) => {
              try {
                const content = await fs.promises.readFile(file, 'utf-8');
                const relativePath = path.relative(process.env.KNOWLEDGE_BASE_DIR || '.', file);
                
                const chunks = content
                  .split(/\\n\\s*\\n/)
                  .filter(chunk => chunk.trim().length > 0)
                  .map(chunk => ({
                    content: chunk.trim(),
                    source: relativePath,
                    keywords: extractKeywords(chunk)
                  }));
                
                parentPort.postMessage(chunks);
              } catch (error) {
                parentPort.postMessage({ error: error.message });
              }
            });

            function extractKeywords(text) {
              const words = text.toLowerCase()
                .replace(/[^\\w\\s]/g, '')
                .split(/\\s+/)
                .filter(word => word.length > 3);
              return new Set(words);
            }
          `, { eval: true });

          worker.on('message', (result) => {
            if (result.error) {
              reject(new Error(result.error));
            } else {
              resolve(result);
            }
            worker.terminate();
          });

          worker.on('error', reject);
          worker.postMessage(file);
        } catch (error) {
          // Fallback to synchronous processing if worker threads fail
          logger.warn('Worker thread failed, using fallback processing', { file, error: error.message });
          resolve(processFileSync(file));
        }
      });
    });

    const results = await Promise.allSettled(workers);
    
    // Collect successful results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        chunks.push(...result.value);
      } else {
        logger.error('Failed to process file', { 
          file: files[index], 
          error: result.reason.message 
        });
      }
    });

    logger.info('Knowledge base loaded', {
      totalFiles: files.length,
      totalChunks: chunks.length,
      successfulFiles: results.filter(r => r.status === 'fulfilled').length
    });

    return chunks;
  } catch (error) {
    logger.error('Failed to load knowledge base', { error: error.message });
    return [];
  }
}

/**
 * Process file synchronously as fallback
 * @param {string} file - File path
 * @returns {Array} Processed chunks
 */
function processFileSync(file) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(KNOWLEDGE_BASE_DIR, file);
    
    return content
      .split(/\n\s*\n/)
      .filter(chunk => chunk.trim().length > 0)
      .map(chunk => ({
        content: chunk.trim(),
        source: relativePath,
        keywords: extractKeywords(chunk)
      }));
  } catch (error) {
    logger.error('Failed to process file synchronously', { file, error: error.message });
    return [];
  }
}

/**
 * Get all files with specific extension recursively
 * @param {string} dir - Directory to search
 * @param {string} ext - File extension
 * @returns {Promise<Array>} Array of file paths
 */
async function getAllFiles(dir, ext) {
  const files = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getAllFiles(fullPath, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Get relevant knowledge base chunks
 * @param {string} query - Search query
 * @returns {Promise<Array>} Relevant chunks
 */
export async function getRelevantChunks(query) {
  try {
    // Check memory cache first
    const memoryCachedChunks = Array.from(memoryCache.values())
      .filter(chunk => {
        const queryWords = query.toLowerCase().split(/\s+/);
        return queryWords.some(word => chunk.keywords.has(word));
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3);

    if (memoryCachedChunks.length > 0) {
      logger.debug('Using memory cached chunks', { count: memoryCachedChunks.length });
      return memoryCachedChunks;
    }

    // Get all chunks from Redis
    const allChunks = await getCache(generateCacheKey(CACHE_PREFIX, 'all'));
    if (!allChunks) {
      return [];
    }

    const queryKeywords = extractKeywords(query);
    const relevantChunks = allChunks
      .map(chunk => {
        const relevanceScore = calculateRelevanceScore(chunk.keywords, queryKeywords);
        return { ...chunk, relevanceScore };
      })
      .filter(chunk => chunk.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3);

    // Update memory cache with new chunks
    relevantChunks.forEach(chunk => {
      if (memoryCache.size >= MEMORY_CACHE_SIZE) {
        const oldestKey = memoryCache.keys().next().value;
        memoryCache.delete(oldestKey);
      }
      memoryCache.set(chunk.content, chunk);
    });

    return relevantChunks;
  } catch (error) {
    logger.error('Failed to get relevant chunks', { error: error.message });
    return [];
  }
}

/**
 * Extract keywords from text
 * @param {string} text - Text to extract keywords from
 * @returns {Set<string>} Set of keywords
 */
function extractKeywords(text) {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  return new Set(words);
}

/**
 * Calculate relevance score between chunk and query
 * @param {Set<string>} chunkKeywords - Chunk keywords
 * @param {Set<string>} queryKeywords - Query keywords
 * @returns {number} Relevance score
 */
function calculateRelevanceScore(chunkKeywords, queryKeywords) {
  let score = 0;
  for (const keyword of queryKeywords) {
    if (chunkKeywords.has(keyword)) {
      score += 1;
    }
  }
  return score;
}

/**
 * Format knowledge base chunks for AI context
 * @param {Array} chunks - Knowledge base chunks
 * @returns {string} Formatted context
 */
export function formatChunksForContext(chunks) {
  return chunks
    .map(chunk => `[From ${chunk.source}]\n${chunk.content}`)
    .join('\n\n');
} 