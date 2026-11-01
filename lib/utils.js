/**
 * Mindora Utilities & Security Helpers
 */

/**
 * Generate a unique ID (UUID v4)
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Fast deterministic 32-bit hash (djb2) for duplicate excerpt detection
 */
export function computeContentHash(url, text) {
  const normalizedUrl = (url || '').split('#')[0].trim().toLowerCase();
  const normalizedText = (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const combined = `${normalizedUrl}::${normalizedText}`;

  let hash = 5381;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) + combined.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Build Chromium Scroll-to-Text Fragment URL (#:~:text=...)
 * Allows clicking a saved item to jump and highlight the exact text on the webpage
 */
export function buildTextFragmentUrl(baseUrl, text) {
  if (!baseUrl || !text) return baseUrl;
  try {
    const urlObj = new URL(baseUrl);
    // Remove existing hash fragments
    urlObj.hash = '';

    const clean = text.trim().replace(/\s+/g, ' ');
    const words = clean.split(' ');

    let fragmentParam = '';
    if (words.length <= 8) {
      // Short phrase: exact match
      fragmentParam = encodeURIComponent(clean);
    } else {
      // Long excerpt: use start,end syntax per W3C specification
      const startPhrase = words.slice(0, 4).join(' ');
      const endPhrase = words.slice(-4).join(' ');
      fragmentParam = `${encodeURIComponent(startPhrase)},${encodeURIComponent(endPhrase)}`;
    }

    return `${urlObj.toString()}#:~:text=${fragmentParam}`;
  } catch (e) {
    return baseUrl;
  }
}

/**
 * Extract clean domain name from URL
 */
export function extractDomain(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

/**
 * Human-friendly relative date formatter
 */
export function formatRelativeDate(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: diffDays > 300 ? 'numeric' : undefined
  });
}

/**
 * HTML Escaper to prevent DOM injection and attribute breakout
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize URLs to prevent javascript: or data: pseudo-protocol execution
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  if (trimmed.startsWith('#')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'chrome-extension:') {
      return trimmed;
    }
  } catch (e) {}
  return '#';
}

/**
 * Validate and sanitize hex color codes to prevent style injection
 */
export function sanitizeColor(color) {
  if (!color || typeof color !== 'string') return '#6366F1';
  const trimmed = color.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return trimmed;
  }
  return '#6366F1';
}

/**
 * Sanitize IDs to allow only safe alphanumeric characters, dashes, and underscores
 */
export function sanitizeId(id) {
  if (!id) return '';
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Sanitize favicon URLs to prevent malicious data URIs
 */
export function sanitizeFaviconUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'chrome-extension:') {
      return trimmed;
    }
  } catch (e) {}
  return '';
}

/**
 * Safely highlight search query tokens within raw text without entity corruption or XSS
 */
export function safeHighlightHtml(rawText, query) {
  if (rawText === null || rawText === undefined) return '';
  const textStr = String(rawText);
  if (!query || typeof query !== 'string') return escapeHtml(textStr);

  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return escapeHtml(textStr);

  const pattern = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');

  const parts = textStr.split(regex);
  return parts.map(part => {
    if (!part) return '';
    const isMatch = tokens.some(tok => tok.toLowerCase() === part.toLowerCase());
    if (isMatch) {
      return `<mark class="search-highlight">${escapeHtml(part)}</mark>`;
    }
    return escapeHtml(part);
  }).join('');
}
