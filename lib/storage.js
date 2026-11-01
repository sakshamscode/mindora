/**
 * Mindora Local Storage Layer
 * Local-first persistence using chrome.storage.local
 */

import { generateUUID, computeContentHash, buildTextFragmentUrl, extractDomain } from './utils.js';

const STORAGE_KEYS = {
  ITEMS: 'mindora_items',
  COLLECTIONS: 'mindora_collections',
  SETTINGS: 'mindora_settings'
};

const DEFAULT_COLLECTIONS = [
  { id: 'col_research', name: 'Research', color: '#6366F1', createdAt: Date.now() },
  { id: 'col_dev', name: 'Engineering', color: '#10B981', createdAt: Date.now() },
  { id: 'col_reading', name: 'Reading List', color: '#F59E0B', createdAt: Date.now() }
];

/**
 * Retrieve all saved items
 */
export async function getItems() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.ITEMS]);
  return result[STORAGE_KEYS.ITEMS] || [];
}

/**
 * Retrieve a single item by ID
 */
export async function getItemById(id) {
  const items = await getItems();
  return items.find(item => item.id === id) || null;
}

/**
 * Check if an excerpt from this URL already exists
 */
export async function findDuplicate(url, text) {
  const hash = computeContentHash(url, text);
  const items = await getItems();
  return items.find(item => item.contentHash === hash) || null;
}

/**
 * Save a new excerpt item to storage
 * Returns { duplicate: true, existingItem } if already present unless allowDuplicate = true
 */
export async function saveItem(data, allowDuplicate = false) {
  const items = await getItems();
  const hash = computeContentHash(data.sourceUrl, data.selectedText);

  if (!allowDuplicate) {
    const existing = items.find(item => item.contentHash === hash);
    if (existing) {
      return { duplicate: true, existingItem: existing };
    }
  }

  const now = Date.now();
  const newItem = {
    id: data.id || generateUUID(),
    selectedText: (data.selectedText || '').trim(),
    userNote: (data.userNote || '').trim(),
    pageTitle: (data.pageTitle || 'Untitled Page').trim(),
    sourceUrl: data.sourceUrl || '',
    sourceDomain: extractDomain(data.sourceUrl),
    faviconUrl: data.faviconUrl || '',
    textFragmentUrl: buildTextFragmentUrl(data.sourceUrl, data.selectedText),
    createdAt: data.createdAt || now,
    updatedAt: now,
    tags: Array.isArray(data.tags) ? Array.from(new Set(data.tags.map(t => t.trim().toLowerCase()).filter(Boolean))) : [],
    collectionId: data.collectionId || null,
    status: data.status || 'unread', // unread | in_progress | reviewed | archived
    contentHash: hash,
    // Translation fields
    isTranslated: !!data.isTranslated || !!(data.translatedText && data.translatedText.trim()),
    translatedText: (data.translatedText || '').trim(),
    sourceLanguage: data.sourceLanguage || '',
    targetLanguage: data.targetLanguage || ''
  };

  items.unshift(newItem); // Newest first
  await chrome.storage.local.set({ [STORAGE_KEYS.ITEMS]: items });

  return { success: true, item: newItem };
}

/**
 * Update an existing item
 */
export async function updateItem(id, updates) {
  const items = await getItems();
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return null;

  const current = items[index];
  const updatedItem = {
    ...current,
    ...updates,
    updatedAt: Date.now()
  };

  // If text or URL changed, update the hash and fragment
  if (updates.selectedText !== undefined || updates.sourceUrl !== undefined) {
    updatedItem.contentHash = computeContentHash(updatedItem.sourceUrl, updatedItem.selectedText);
    updatedItem.textFragmentUrl = buildTextFragmentUrl(updatedItem.sourceUrl, updatedItem.selectedText);
    updatedItem.sourceDomain = extractDomain(updatedItem.sourceUrl);
  }

  if (updates.translatedText !== undefined) {
    updatedItem.translatedText = updates.translatedText.trim();
    updatedItem.isTranslated = !!updatedItem.translatedText;
  }

  if (Array.isArray(updatedItem.tags)) {
    updatedItem.tags = Array.from(new Set(updatedItem.tags.map(t => t.trim().toLowerCase()).filter(Boolean)));
  }

  items[index] = updatedItem;
  await chrome.storage.local.set({ [STORAGE_KEYS.ITEMS]: items });
  return updatedItem;
}

/**
 * Delete an item
 */
export async function deleteItem(id) {
  const items = await getItems();
  const filtered = items.filter(item => item.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.ITEMS]: filtered });
  return true;
}

/**
 * Get all collections
 */
export async function getCollections() {
  const result = await chrome.storage.local.get([STORAGE_KEYS.COLLECTIONS]);
  if (!result[STORAGE_KEYS.COLLECTIONS]) {
    // Seed default collections if none exist
    await chrome.storage.local.set({ [STORAGE_KEYS.COLLECTIONS]: DEFAULT_COLLECTIONS });
    return DEFAULT_COLLECTIONS;
  }
  return result[STORAGE_KEYS.COLLECTIONS];
}

/**
 * Create a new collection
 */
export async function createCollection(name, color = '#6366F1') {
  const collections = await getCollections();
  const newCol = {
    id: 'col_' + generateUUID().slice(0, 8),
    name: name.trim(),
    color: color,
    createdAt: Date.now()
  };
  collections.push(newCol);
  await chrome.storage.local.set({ [STORAGE_KEYS.COLLECTIONS]: collections });
  return newCol;
}

/**
 * Delete a collection and unassign its items
 */
export async function deleteCollection(id) {
  let collections = await getCollections();
  collections = collections.filter(c => c.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.COLLECTIONS]: collections });

  // Reset items that belonged to this collection
  const items = await getItems();
  let modified = false;
  items.forEach(item => {
    if (item.collectionId === id) {
      item.collectionId = null;
      modified = true;
    }
  });
  if (modified) {
    await chrome.storage.local.set({ [STORAGE_KEYS.ITEMS]: items });
  }
  return true;
}

/**
 * Gather all unique tags currently in use
 */
export async function getAllTags() {
  const items = await getItems();
  const tagSet = new Set();
  items.forEach(item => {
    if (Array.isArray(item.tags)) {
      item.tags.forEach(tag => tagSet.add(tag));
    }
  });
  return Array.from(tagSet).sort();
}

/**
 * Gather all unique source languages detected across saved items
 */
export async function getSavedLanguages() {
  const items = await getItems();
  const langSet = new Set();
  items.forEach(item => {
    if (item.sourceLanguage && item.sourceLanguage !== 'auto') {
      langSet.add(item.sourceLanguage.toLowerCase());
    }
  });
  return Array.from(langSet).sort();
}

/**
 * Summary statistics for the library
 */
export async function getLibraryStats() {
  const [items, collections] = await Promise.all([getItems(), getCollections()]);
  const stats = {
    total: items.length,
    unread: 0,
    in_progress: 0,
    reviewed: 0,
    archived: 0,
    translatedCount: 0,
    collectionsCount: collections.length
  };
  items.forEach(item => {
    if (stats[item.status] !== undefined) {
      stats[item.status]++;
    }
    if (item.isTranslated && item.translatedText) {
      stats.translatedCount++;
    }
  });
  return stats;
}
