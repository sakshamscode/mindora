/**
 * Mindora Library Workspace Controller
 */

import {
  getItems,
  getCollections,
  createCollection,
  deleteCollection,
  updateItem,
  deleteItem,
  getAllTags,
  getLibraryStats
} from '../lib/storage.js';

import {
  exportAsMarkdown,
  exportAsJSON,
  importFromJSON
} from '../lib/export.js';

import { formatRelativeDate, escapeHtml } from '../lib/utils.js';

// Application State
const state = {
  items: [],
  collections: [],
  tags: [],
  stats: {},
  filters: {
    status: 'all',
    collectionId: null,
    tag: null,
    searchQuery: '',
    sortBy: 'newest'
  },
  editingItemId: null
};

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  await refreshData();
});

function initTheme() {
  const savedTheme = localStorage.getItem('mindora_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButtonText(savedTheme);
}

function updateThemeButtonText(theme) {
  const btn = document.getElementById('theme-toggle-btn');
  btn.textContent = theme === 'light' ? '🌙 Dark' : '☀️ Light';
  btn.title = theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('mindora_theme', next);
  updateThemeButtonText(next);
}

function setupEventListeners() {
  // Theme toggle
  document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

  // Search input & keyboard shortcut '/'
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');

  searchInput.addEventListener('input', (e) => {
    state.filters.searchQuery = e.target.value.trim().toLowerCase();
    searchClearBtn.style.display = state.filters.searchQuery ? 'block' : 'none';
    renderItems();
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.filters.searchQuery = '';
    searchClearBtn.style.display = 'none';
    searchInput.focus();
    renderItems();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput && !isModalOpen()) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // Sort dropdown
  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.filters.sortBy = e.target.value;
    renderItems();
  });

  // Navigation views (Status filters)
  document.querySelectorAll('.nav-item[data-filter-type="status"]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filters.status = btn.dataset.filterValue;
      updateFilterRibbon();
      renderItems();
    });
  });

  // Add Collection
  document.getElementById('add-collection-btn').addEventListener('click', async () => {
    const name = prompt('Enter collection name:');
    if (!name || !name.trim()) return;

    const colors = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#0EA5E9'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    await createCollection(name.trim(), randomColor);
    await refreshData();
  });

  // Clear all filters button
  document.getElementById('clear-all-filters-btn').addEventListener('click', () => {
    resetFilters();
  });

  // Export & Backup
  document.getElementById('export-md-btn').addEventListener('click', async () => {
    await exportAsMarkdown();
  });

  document.getElementById('backup-json-btn').addEventListener('click', async () => {
    await exportAsJSON();
  });

  // Import Modal
  setupImportModal();

  // Edit Modal
  setupEditModal();
}

function isModalOpen() {
  return document.querySelector('.modal-backdrop.open') !== null;
}

function resetFilters() {
  state.filters.status = 'all';
  state.filters.collectionId = null;
  state.filters.tag = null;
  state.filters.searchQuery = '';
  document.getElementById('search-input').value = '';
  document.getElementById('search-clear-btn').style.display = 'none';

  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-item[data-filter-value="all"]').classList.add('active');

  updateFilterRibbon();
  renderItems();
}

async function refreshData() {
  const [items, collections, tags, stats] = await Promise.all([
    getItems(),
    getCollections(),
    getAllTags(),
    getLibraryStats()
  ]);

  state.items = items;
  state.collections = collections;
  state.tags = tags;
  state.stats = stats;

  updateSidebarCounters();
  renderCollections();
  renderTagsCloud();
  updateFilterRibbon();
  renderItems();
}

function updateSidebarCounters() {
  document.getElementById('count-all').textContent = state.stats.total || 0;
  document.getElementById('count-unread').textContent = state.stats.unread || 0;
  document.getElementById('count-in_progress').textContent = state.stats.in_progress || 0;
  document.getElementById('count-reviewed').textContent = state.stats.reviewed || 0;
  document.getElementById('count-archived').textContent = state.stats.archived || 0;
}

function renderCollections() {
  const container = document.getElementById('collections-list');
  container.innerHTML = '';

  state.collections.forEach(col => {
    const itemCount = state.items.filter(i => i.collectionId === col.id).length;
    const itemEl = document.createElement('div');
    itemEl.className = 'collection-item';

    const isActive = state.filters.collectionId === col.id;

    itemEl.innerHTML = `
      <button class="nav-item ${isActive ? 'active' : ''}" data-col-id="${col.id}">
        <span class="color-dot" style="background-color: ${col.color || '#6366F1'};"></span>
        <span class="nav-item-label">${escapeHtml(col.name)}</span>
        <span class="nav-item-count">${itemCount}</span>
      </button>
      <button class="collection-delete-btn" title="Delete collection">&times;</button>
    `;

    // Click to filter by collection
    itemEl.querySelector('.nav-item').addEventListener('click', () => {
      if (state.filters.collectionId === col.id) {
        state.filters.collectionId = null;
      } else {
        state.filters.collectionId = col.id;
      }
      renderCollections();
      updateFilterRibbon();
      renderItems();
    });

    // Delete collection
    itemEl.querySelector('.collection-delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete collection "${col.name}"? Saved items will be kept and moved to General.`)) {
        await deleteCollection(col.id);
        if (state.filters.collectionId === col.id) {
          state.filters.collectionId = null;
        }
        await refreshData();
      }
    });

    container.appendChild(itemEl);
  });
}

function renderTagsCloud() {
  const container = document.getElementById('tags-cloud');
  container.innerHTML = '';

  if (state.tags.length === 0) {
    container.innerHTML = '<span style="font-size:11px;color:var(--text-muted);padding-left:8px;">No tags yet</span>';
    return;
  }

  state.tags.forEach(tag => {
    const count = state.items.filter(i => i.tags && i.tags.includes(tag)).length;
    const chip = document.createElement('span');
    const isActive = state.filters.tag === tag;
    chip.className = `tag-chip ${isActive ? 'active' : ''}`;
    chip.style.cursor = 'pointer';
    chip.innerHTML = `#${escapeHtml(tag)} <span style="opacity:0.6;font-size:10px;">(${count})</span>`;

    chip.addEventListener('click', () => {
      state.filters.tag = state.filters.tag === tag ? null : tag;
      renderTagsCloud();
      updateFilterRibbon();
      renderItems();
    });

    container.appendChild(chip);
  });
}

function updateFilterRibbon() {
  const ribbon = document.getElementById('filter-ribbon');
  const chipsContainer = document.getElementById('active-filter-chips');
  chipsContainer.innerHTML = '';

  const activeFilters = [];

  if (state.filters.status !== 'all') {
    activeFilters.push({
      label: `Status: ${state.filters.status.replace('_', ' ')}`,
      clear: () => {
        state.filters.status = 'all';
        document.querySelectorAll('.nav-item[data-filter-type="status"]').forEach(b => b.classList.remove('active'));
        document.querySelector('.nav-item[data-filter-value="all"]').classList.add('active');
      }
    });
  }

  if (state.filters.collectionId) {
    const col = state.collections.find(c => c.id === state.filters.collectionId);
    activeFilters.push({
      label: `Collection: ${col ? col.name : 'Unknown'}`,
      clear: () => {
        state.filters.collectionId = null;
        renderCollections();
      }
    });
  }

  if (state.filters.tag) {
    activeFilters.push({
      label: `Tag: #${state.filters.tag}`,
      clear: () => {
        state.filters.tag = null;
        renderTagsCloud();
      }
    });
  }

  if (activeFilters.length === 0) {
    ribbon.style.display = 'none';
    return;
  }

  ribbon.style.display = 'flex';
  activeFilters.forEach(f => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip active';
    chip.innerHTML = `
      <span>${escapeHtml(f.label)}</span>
      <button class="remove-btn">&times;</button>
    `;
    chip.querySelector('.remove-btn').addEventListener('click', () => {
      f.clear();
      updateFilterRibbon();
      renderItems();
    });
    chipsContainer.appendChild(chip);
  });
}

function getFilteredAndSortedItems() {
  let list = [...state.items];

  // 1. Status Filter
  if (state.filters.status !== 'all') {
    list = list.filter(item => item.status === state.filters.status);
  }

  // 2. Collection Filter
  if (state.filters.collectionId) {
    list = list.filter(item => item.collectionId === state.filters.collectionId);
  }

  // 3. Tag Filter
  if (state.filters.tag) {
    list = list.filter(item => item.tags && item.tags.includes(state.filters.tag));
  }

  // 4. Client-side Search Query Filter
  if (state.filters.searchQuery) {
    const tokens = state.filters.searchQuery.split(/\s+/).filter(Boolean);
    list = list.filter(item => {
      const haystack = [
        item.selectedText,
        item.userNote,
        item.pageTitle,
        item.sourceDomain,
        ...(item.tags || [])
      ].join(' ').toLowerCase();

      // All tokens must match
      return tokens.every(token => haystack.includes(token));
    });
  }

  // 5. Sorting
  switch (state.filters.sortBy) {
    case 'oldest':
      list.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case 'title':
      list.sort((a, b) => (a.pageTitle || '').localeCompare(b.pageTitle || ''));
      break;
    case 'domain':
      list.sort((a, b) => (a.sourceDomain || '').localeCompare(b.sourceDomain || ''));
      break;
    case 'newest':
    default:
      list.sort((a, b) => b.createdAt - a.createdAt);
      break;
  }

  return list;
}

function renderItems() {
  const container = document.getElementById('items-grid');
  const items = getFilteredAndSortedItems();

  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">No items found</div>
        <div class="empty-state-desc">
          ${state.items.length === 0 
            ? 'Your Mindora vault is empty. Select text on any webpage and press Alt+S to save your first excerpt!' 
            : 'No saved excerpts match your current filters or search term.'}
        </div>
      </div>
    `;
    return;
  }

  const collectionsMap = {};
  state.collections.forEach(c => { collectionsMap[c.id] = c; });

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card';

    const col = item.collectionId ? collectionsMap[item.collectionId] : null;
    const colBadgeHtml = col 
      ? `<span class="collection-pill" style="font-size:11px;padding:2px 8px;">
           <span class="color-dot" style="background-color:${col.color}"></span>
           ${escapeHtml(col.name)}
         </span>`
      : '';

    const tagsHtml = (item.tags && item.tags.length > 0)
      ? `<div class="card-tags">
          ${item.tags.map(t => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join('')}
         </div>`
      : '';

    const noteHtml = item.userNote
      ? `<div class="item-note"><strong>Takeaway:</strong> ${highlightText(escapeHtml(item.userNote), state.filters.searchQuery)}</div>`
      : '';

    const highlightedExcerpt = highlightText(escapeHtml(item.selectedText), state.filters.searchQuery);
    const highlightedTitle = highlightText(escapeHtml(item.pageTitle || 'Untitled'), state.filters.searchQuery);

    const revisitUrl = item.textFragmentUrl || item.sourceUrl;

    card.innerHTML = `
      <div class="card-header">
        <div class="card-source-badge">
          ${item.faviconUrl ? `<img src="${item.faviconUrl}" class="card-favicon" onerror="this.style.display='none'">` : ''}
          <a href="${item.sourceUrl}" target="_blank" class="item-source-link" title="${escapeHtml(item.sourceUrl)}">
            ${escapeHtml(item.sourceDomain || 'Web')}
          </a>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${colBadgeHtml}
          <select class="select select-sm card-status-select" data-item-id="${item.id}" style="padding:2px 6px;font-size:11px;">
            <option value="unread" ${item.status === 'unread' ? 'selected' : ''}>Unread</option>
            <option value="in_progress" ${item.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="reviewed" ${item.status === 'reviewed' ? 'selected' : ''}>Reviewed</option>
            <option value="archived" ${item.status === 'archived' ? 'selected' : ''}>Archived</option>
          </select>
        </div>
      </div>

      <div class="card-title">
        <a href="${revisitUrl}" target="_blank" title="Open source page">${highlightedTitle}</a>
      </div>

      <div class="item-excerpt">
        "${highlightedExcerpt}"
      </div>

      ${noteHtml}
      ${tagsHtml}

      <div class="item-footer">
        <span>Captured ${formatRelativeDate(item.createdAt)}</span>
        <div class="card-actions">
          <a href="${revisitUrl}" target="_blank" class="revisit-btn" title="Revisit on page with highlighted quote">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Revisit
          </a>
          <button class="btn btn-icon btn-sm edit-btn" data-item-id="${item.id}" title="Edit item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn btn-icon btn-sm delete-btn" data-item-id="${item.id}" title="Delete item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Handle Quick Status Change
    card.querySelector('.card-status-select').addEventListener('change', async (e) => {
      const newStatus = e.target.value;
      await updateItem(item.id, { status: newStatus });
      await refreshData();
    });

    // Handle Edit Click
    card.querySelector('.edit-btn').addEventListener('click', () => {
      openEditModal(item);
    });

    // Handle Delete Click
    card.querySelector('.delete-btn').addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this saved excerpt?')) {
        await deleteItem(item.id);
        await refreshData();
      }
    });

    container.appendChild(card);
  });
}

function highlightText(text, query) {
  if (!query) return text;
  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;

  // Escape tokens for regex
  const pattern = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/* Edit Modal Logic */
function setupEditModal() {
  const modal = document.getElementById('edit-modal');
  const closeBtn = document.getElementById('edit-modal-close');
  const cancelBtn = document.getElementById('edit-modal-cancel');
  const saveBtn = document.getElementById('edit-modal-save');

  const closeModal = () => {
    modal.classList.remove('open');
    state.editingItemId = null;
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  saveBtn.addEventListener('click', async () => {
    if (!state.editingItemId) return;

    const excerpt = document.getElementById('edit-excerpt').value.trim();
    const note = document.getElementById('edit-note').value.trim();
    const collectionId = document.getElementById('edit-collection').value || null;
    const status = document.getElementById('edit-status').value;
    const tagsRaw = document.getElementById('edit-tags').value;
    const tags = tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

    await updateItem(state.editingItemId, {
      selectedText: excerpt,
      userNote: note,
      collectionId: collectionId,
      status: status,
      tags: tags
    });

    closeModal();
    await refreshData();
  });
}

function openEditModal(item) {
  state.editingItemId = item.id;
  const modal = document.getElementById('edit-modal');

  document.getElementById('edit-excerpt').value = item.selectedText || '';
  document.getElementById('edit-note').value = item.userNote || '';
  document.getElementById('edit-status').value = item.status || 'unread';
  document.getElementById('edit-tags').value = (item.tags || []).join(', ');

  // Populate collection select
  const colSelect = document.getElementById('edit-collection');
  colSelect.innerHTML = '<option value="">General (No collection)</option>';
  state.collections.forEach(col => {
    const opt = document.createElement('option');
    opt.value = col.id;
    opt.textContent = col.name;
    if (item.collectionId === col.id) {
      opt.selected = true;
    }
    colSelect.appendChild(opt);
  });

  modal.classList.add('open');
}

/* Import / Restore Modal Logic */
function setupImportModal() {
  const modal = document.getElementById('import-modal');
  const openBtn = document.getElementById('import-btn');
  const closeBtn = document.getElementById('import-modal-close');
  const cancelBtn = document.getElementById('import-modal-cancel');
  const confirmBtn = document.getElementById('import-modal-confirm');
  const fileInput = document.getElementById('import-file-input');
  const resultMsg = document.getElementById('import-result-msg');

  let fileContent = null;

  openBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileContent = null;
    confirmBtn.disabled = true;
    resultMsg.style.display = 'none';
    modal.classList.add('open');
  });

  const closeModal = () => {
    modal.classList.remove('open');
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        fileContent = event.target.result;
        confirmBtn.disabled = false;
      };
      reader.readAsText(file);
    } else {
      fileContent = null;
      confirmBtn.disabled = true;
    }
  });

  confirmBtn.addEventListener('click', async () => {
    if (!fileContent) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Importing...';

    const mode = document.getElementById('import-mode-select').value;

    try {
      const res = await importFromJSON(fileContent, mode);
      resultMsg.style.display = 'block';
      resultMsg.style.background = 'rgba(16, 185, 129, 0.15)';
      resultMsg.style.color = '#34D399';
      resultMsg.textContent = `Success! Imported ${res.importedItems} items, added ${res.importedCollections} collections, skipped ${res.skippedDuplicates} duplicates.`;

      setTimeout(async () => {
        closeModal();
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Start Import';
        await refreshData();
      }, 1800);
    } catch (err) {
      resultMsg.style.display = 'block';
      resultMsg.style.background = 'rgba(244, 63, 94, 0.15)';
      resultMsg.style.color = '#F43F5E';
      resultMsg.textContent = `Import failed: ${err.message}`;
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Start Import';
    }
  });
}
