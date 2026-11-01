/**
 * Mindora Data Export and Portability
 * Supports Markdown export for notes and full JSON backup/restore with schema sanitization
 */

import { getItems, getCollections, saveItem } from './storage.js';
import { sanitizeUrl, sanitizeColor, sanitizeId, sanitizeFaviconUrl } from './utils.js';

/**
 * Generate Markdown representation of items
 */
export function generateMarkdown(items, collectionsMap = {}) {
  let md = `# Mindora Knowledge Export\n\n`;
  md += `*Exported on ${new Date().toLocaleString()} — ${items.length} item(s)*\n\n---\n\n`;

  items.forEach((item, index) => {
    const dateStr = new Date(item.createdAt).toLocaleDateString();
    const collectionName = item.collectionId && collectionsMap[item.collectionId] 
      ? collectionsMap[item.collectionId].name 
      : 'General';
    const tagList = (item.tags && item.tags.length > 0)
      ? item.tags.map(t => `\`#${t}\``).join(' ')
      : 'None';

    const safeSourceUrl = sanitizeUrl(item.sourceUrl);
    md += `### ${index + 1}. [${item.pageTitle || 'Untitled'}](${safeSourceUrl})\n\n`;
    
    // Blockquote original excerpt
    const quoted = (item.selectedText || '')
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');
    md += `${quoted}\n\n`;

    // Translated excerpt if present
    if (item.isTranslated && item.translatedText) {
      const targetLabel = item.targetLanguage ? item.targetLanguage.toUpperCase() : 'Translated';
      const quotedTrans = item.translatedText
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n');
      md += `**Translation (${targetLabel}):**\n\n${quotedTrans}\n\n`;
    }

    if (item.userNote) {
      md += `**Takeaway:** ${item.userNote}\n\n`;
    }

    md += `*Collection:* **${collectionName}** | *Status:* \`${item.status}\` | *Captured:* ${dateStr}\n`;
    md += `*Tags:* ${tagList}\n\n`;
    if (item.textFragmentUrl) {
      const safeFragmentUrl = sanitizeUrl(item.textFragmentUrl);
      md += `[Revisit in context on page](${safeFragmentUrl})\n\n`;
    }
    md += `---\n\n`;
  });

  return md;
}

/**
 * Trigger browser file download
 */
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Export library as Markdown (.md)
 */
export async function exportAsMarkdown() {
  const [items, collections] = await Promise.all([getItems(), getCollections()]);
  const collectionsMap = {};
  collections.forEach(c => { collectionsMap[c.id] = c; });

  const mdContent = generateMarkdown(items, collectionsMap);
  const dateSlug = new Date().toISOString().slice(0, 10);
  downloadFile(mdContent, `mindora-notes-${dateSlug}.md`, 'text/markdown;charset=utf-8');
  return true;
}

/**
 * Export full database backup as JSON
 */
export async function exportAsJSON() {
  const [items, collections] = await Promise.all([getItems(), getCollections()]);
  const backup = {
    app: 'Mindora',
    version: '1.1.0',
    exportedAt: Date.now(),
    stats: {
      totalItems: items.length,
      totalCollections: collections.length
    },
    collections,
    items
  };

  const jsonContent = JSON.stringify(backup, null, 2);
  const dateSlug = new Date().toISOString().slice(0, 10);
  downloadFile(jsonContent, `mindora-backup-${dateSlug}.json`, 'application/json;charset=utf-8');
  return true;
}

/**
 * Import and restore library from JSON with schema sanitization
 */
export async function importFromJSON(jsonString, mode = 'merge') {
  let data;
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    throw new Error('Invalid JSON file format.');
  }

  if (!data || !Array.isArray(data.items)) {
    throw new Error('Invalid Mindora backup schema: missing items array.');
  }

  const existingCollections = await getCollections();
  const existingCollectionIds = new Set(existingCollections.map(c => c.id));
  let addedCollectionsCount = 0;

  // Restore collections with strict property sanitization
  if (Array.isArray(data.collections)) {
    for (const col of data.collections) {
      if (col && typeof col === 'object' && col.id && col.name) {
        const cleanId = sanitizeId(col.id);
        if (cleanId && !existingCollectionIds.has(cleanId)) {
          existingCollections.push({
            id: cleanId,
            name: String(col.name).trim().slice(0, 100),
            color: sanitizeColor(col.color),
            createdAt: Number(col.createdAt) || Date.now()
          });
          existingCollectionIds.add(cleanId);
          addedCollectionsCount++;
        }
      }
    }
    await chrome.storage.local.set({ mindora_collections: existingCollections });
  }

  let importedItemsCount = 0;
  let skippedCount = 0;

  for (const item of data.items) {
    if (!item || typeof item !== 'object') continue;
    if (!item.selectedText && !item.sourceUrl) continue;

    // Sanitize item properties before saving to local storage
    const sanitizedItem = {
      id: sanitizeId(item.id) || undefined,
      selectedText: String(item.selectedText || '').trim(),
      userNote: String(item.userNote || '').trim(),
      pageTitle: String(item.pageTitle || 'Untitled Page').trim().slice(0, 300),
      sourceUrl: sanitizeUrl(item.sourceUrl),
      sourceDomain: typeof item.sourceDomain === 'string' ? item.sourceDomain.slice(0, 150) : '',
      faviconUrl: sanitizeFaviconUrl(item.faviconUrl),
      textFragmentUrl: sanitizeUrl(item.textFragmentUrl),
      createdAt: Number(item.createdAt) || Date.now(),
      tags: Array.isArray(item.tags)
        ? Array.from(new Set(item.tags.map(t => String(t).trim().toLowerCase().slice(0, 50)).filter(Boolean)))
        : [],
      collectionId: item.collectionId ? sanitizeId(item.collectionId) : null,
      status: ['unread', 'in_progress', 'reviewed', 'archived'].includes(item.status) ? item.status : 'unread',
      isTranslated: !!item.isTranslated,
      translatedText: String(item.translatedText || '').trim(),
      sourceLanguage: typeof item.sourceLanguage === 'string' ? item.sourceLanguage.slice(0, 10) : '',
      targetLanguage: typeof item.targetLanguage === 'string' ? item.targetLanguage.slice(0, 10) : ''
    };

    // In merge mode, duplicates are skipped
    const allowDup = mode === 'replace';
    const res = await saveItem(sanitizedItem, allowDup);
    if (res.duplicate) {
      skippedCount++;
    } else {
      importedItemsCount++;
    }
  }

  return {
    importedItems: importedItemsCount,
    skippedDuplicates: skippedCount,
    importedCollections: addedCollectionsCount
  };
}
