/**
 * Mindora Zero-Cost Content Translation Engine
 * Translates web excerpts and notes into the user's desired language.
 * Production-ready: 0 API keys required, 0 cloud cost, automatic language detection, multi-sentence support, and local caching.
 */

import { computeContentHash } from './utils.js';
import { SUPPORTED_LANGUAGES } from './i18n.js';

// Local in-memory cache for fast lookups during active sessions
const memoryCache = new Map();

/**
 * Translate text into the desired target language
 * @param {string} text - The excerpt or note to translate
 * @param {string} targetLang - Target language code (e.g. 'en', 'hi', 'es', 'fr', 'de', 'ja', 'zh')
 * @param {string} sourceLang - Source language code or 'auto' for auto-detection
 * @returns {Promise<{ translatedText: string, sourceLang: string, targetLang: string, isCached: boolean }>}
 */
export async function translateText(text, targetLang = 'en', sourceLang = 'auto') {
  const cleanText = (text || '').trim();
  if (!cleanText) {
    return { translatedText: '', sourceLang: 'auto', targetLang, isCached: false };
  }

  // 1. Check in-memory cache
  const cacheKey = computeContentHash(targetLang + '::' + sourceLang, cleanText);
  if (memoryCache.has(cacheKey)) {
    return {
      translatedText: memoryCache.get(cacheKey).translatedText,
      sourceLang: memoryCache.get(cacheKey).sourceLang || sourceLang,
      targetLang,
      isCached: true
    };
  }

  // 2. Check chrome.storage.local cache
  try {
    const storageRes = await chrome.storage.local.get(['mindora_trans_cache']);
    const diskCache = storageRes.mindora_trans_cache || {};
    if (diskCache[cacheKey]) {
      const cached = diskCache[cacheKey];
      memoryCache.set(cacheKey, cached);
      return {
        translatedText: cached.translatedText,
        sourceLang: cached.sourceLang || sourceLang,
        targetLang,
        isCached: true
      };
    }
  } catch (e) {
    // Chrome storage not available in some test environments
  }

  // 3. Attempt Modern Chrome On-Device AI Translation (if supported by browser)
  if (typeof translation !== 'undefined' && translation.createTranslator) {
    try {
      const translator = await translation.createTranslator({
        sourceLanguage: sourceLang === 'auto' ? 'en' : sourceLang,
        targetLanguage: targetLang
      });
      const result = await translator.translate(cleanText);
      if (result) {
        saveToCache(cacheKey, result, sourceLang);
        return { translatedText: result, sourceLang, targetLang, isCached: false };
      }
    } catch (err) {
      // Fall through to resilient zero-key client engine
    }
  }

  // 4. Resilient Zero-Key Translation Engine (supports 100+ languages, auto-detect, zero cost)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(cleanText)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Translation network status: ${response.status}`);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data[0])) {
      throw new Error('Unexpected translation response structure');
    }

    // Join all sentence fragments
    const translatedFragments = data[0].map(segment => segment[0]).filter(Boolean);
    const translatedText = translatedFragments.join('');
    const detectedLang = data[2] || sourceLang;

    // Cache result
    saveToCache(cacheKey, translatedText, detectedLang);

    return {
      translatedText,
      sourceLang: detectedLang,
      targetLang,
      isCached: false
    };
  } catch (error) {
    console.warn('Mindora translation fallback error:', error);
    // If translation fails (e.g. offline), return original text with error flag
    return {
      translatedText: cleanText,
      sourceLang: sourceLang,
      targetLang,
      error: error.message,
      isCached: false
    };
  }
}

/**
 * Save translation entry to both memory and local storage
 */
async function saveToCache(cacheKey, translatedText, sourceLang) {
  const entry = { translatedText, sourceLang, timestamp: Date.now() };
  memoryCache.set(cacheKey, entry);

  try {
    const storageRes = await chrome.storage.local.get(['mindora_trans_cache']);
    const diskCache = storageRes.mindora_trans_cache || {};

    // Limit cache to 300 entries to preserve storage
    const keys = Object.keys(diskCache);
    if (keys.length > 300) {
      delete diskCache[keys[0]];
    }

    diskCache[cacheKey] = entry;
    await chrome.storage.local.set({ mindora_trans_cache: diskCache });
  } catch (e) {
    // Non-fatal
  }
}

/**
 * Resolve friendly native name for any language code
 */
export function getLanguageName(code) {
  if (!code || code === 'auto') return 'Auto';
  const found = SUPPORTED_LANGUAGES.find(l => l.code === code.toLowerCase());
  return found ? `${found.nativeName} (${found.name})` : code.toUpperCase();
}
