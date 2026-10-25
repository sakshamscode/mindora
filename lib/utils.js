/**
 * Mindora Utilities
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
 * HTML Escaper to prevent any DOM injection
 */
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
