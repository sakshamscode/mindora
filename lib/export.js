/**
 * Mindora Data Export and Portability
 * Supports Markdown export for notes and full JSON backup/restore
 */

import { getItems, getCollections, saveItem } from './storage.js';

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

    md += `### ${index + 1}. [${item.pageTitle || 'Untitled'}](${item.sourceUrl})\n\n`;
    
    // Blockquote excerpt
    const quoted = (item.selectedText || '')
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');
    md += `${quoted}\n\n`;

    if (item.userNote) {
      md += `**Takeaway:** ${item.userNote}\n\n`;
    }

    md += `*Collection:* **${collectionName}** | *Status:* \`${item.status}\` | *Captured:* ${dateStr}\n`;
    md += `*Tags:* ${tagList}\n\n`;
    if (item.textFragmentUrl) {
      md += `[Revisit in context on page](${item.textFragmentUrl})\n\n`;
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
    version: '1.0.0',
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
 * Import and restore library from JSON
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

  // Restore collections
  if (Array.isArray(data.collections)) {
    for (const col of data.collections) {
      if (col.id && col.name && !existingCollectionIds.has(col.id)) {
        existingCollections.push(col);
        existingCollectionIds.add(col.id);
        addedCollectionsCount++;
      }
    }
    await chrome.storage.local.set({ mindora_collections: existingCollections });
  }

  let importedItemsCount = 0;
  let skippedCount = 0;

  for (const item of data.items) {
    if (!item.selectedText && !item.sourceUrl) continue;
    
    // In merge mode, duplicates are skipped
    const allowDup = mode === 'replace';
    const res = await saveItem(item, allowDup);
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
