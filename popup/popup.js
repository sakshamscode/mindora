/**
 * Mindora Quick Capture Popup Controller
 */

import { getItems, getCollections, saveItem, findDuplicate, createCollection } from '../lib/storage.js';
import { formatRelativeDate, escapeHtml } from '../lib/utils.js';

let currentTab = null;
let currentTags = [];

document.addEventListener('DOMContentLoaded', async () => {
  await initPopup();
});

async function initPopup() {
  initTheme();
  setupEventListeners();
  await loadCollections();
  await detectActiveTabAndSelection();
  await loadRecentItems();
}

function initTheme() {
  const savedTheme = localStorage.getItem('mindora_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function setupEventListeners() {
  // Save button
  document.getElementById('save-btn').addEventListener('click', handleSave);

  // Library buttons
  document.getElementById('open-library-btn').addEventListener('click', openLibrary);
  document.getElementById('footer-library-btn').addEventListener('click', openLibrary);

  // New collection button
  document.getElementById('new-collection-btn').addEventListener('click', handleNewCollection);

  // Tag input handling
  const tagInput = document.getElementById('tag-input');
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.value.replace(/,/g, '').trim().toLowerCase();
      if (val && !currentTags.includes(val)) {
        currentTags.push(val);
        renderTags();
      }
      tagInput.value = '';
    } else if (e.key === 'Backspace' && !tagInput.value && currentTags.length > 0) {
      currentTags.pop();
      renderTags();
    }
  });

  // Re-check duplicate on manual textarea change
  document.getElementById('excerpt-input').addEventListener('input', async (e) => {
    if (currentTab && currentTab.url) {
      const text = e.target.value.trim();
      const dup = text ? await findDuplicate(currentTab.url, text) : null;
      toggleDuplicateBanner(!!dup);
    }
  });
}

async function detectActiveTabAndSelection() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;

    currentTab = tabs[0];

    // Try communicating with content script
    try {
      const pageData = await chrome.tabs.sendMessage(currentTab.id, { action: 'GET_SELECTION_DATA' });
      if (pageData && pageData.selectedText) {
        const excerptInput = document.getElementById('excerpt-input');
        excerptInput.value = pageData.selectedText;

        const badge = document.getElementById('selection-status-badge');
        badge.classList.add('active');

        // Check if duplicate
        const dup = await findDuplicate(pageData.url, pageData.selectedText);
        toggleDuplicateBanner(!!dup);
      }
    } catch (e) {
      // Content script might not be injected yet on internal chrome:// or extension gallery pages
    }
  } catch (err) {
    console.error('Active tab detection error:', err);
  }
}

async function loadCollections(selectedId = null) {
  const collections = await getCollections();
  const select = document.getElementById('collection-select');

  // Retain the default option
  select.innerHTML = '<option value="">General (No collection)</option>';

  collections.forEach(col => {
    const opt = document.createElement('option');
    opt.value = col.id;
    opt.textContent = col.name;
    if (selectedId && col.id === selectedId) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

function renderTags() {
  const container = document.getElementById('tags-container');
  const tagInput = document.getElementById('tag-input');

  // Remove existing chips
  const existingChips = container.querySelectorAll('.tag-chip');
  existingChips.forEach(chip => chip.remove());

  currentTags.forEach((tag, idx) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `
      <span>#${escapeHtml(tag)}</span>
      <button type="button" class="remove-btn" data-index="${idx}">&times;</button>
    `;

    chip.querySelector('.remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      currentTags.splice(idx, 1);
      renderTags();
    });

    container.insertBefore(chip, tagInput);
  });
}

function toggleDuplicateBanner(show) {
  const banner = document.getElementById('duplicate-banner');
  banner.style.display = show ? 'flex' : 'none';
}

async function handleNewCollection() {
  const name = prompt('Enter new collection name:');
  if (!name || !name.trim()) return;

  const newCol = await createCollection(name.trim());
  await loadCollections(newCol.id);
}

async function handleSave() {
  const saveBtn = document.getElementById('save-btn');
  const excerptInput = document.getElementById('excerpt-input');
  const noteInput = document.getElementById('note-input');
  const collectionSelect = document.getElementById('collection-select');
  const statusSelect = document.getElementById('status-select');

  const excerpt = excerptInput.value.trim();
  if (!excerpt && (!currentTab || !currentTab.title)) {
    excerptInput.focus();
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const savePayload = {
      selectedText: excerpt || `Saved page bookmark: ${currentTab?.title || 'Webpage'}`,
      userNote: noteInput.value.trim(),
      pageTitle: currentTab?.title || 'Untitled',
      sourceUrl: currentTab?.url || '',
      faviconUrl: currentTab?.favIconUrl || '',
      collectionId: collectionSelect.value || null,
      status: statusSelect.value || 'unread',
      tags: [...currentTags]
    };

    const res = await saveItem(savePayload, true); // Allow duplicate if user explicitly clicks save

    saveBtn.classList.remove('btn-primary');
    saveBtn.style.background = '#10B981';
    saveBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Saved!
    `;

    // Reset inputs
    setTimeout(() => {
      noteInput.value = '';
      currentTags = [];
      renderTags();
      saveBtn.disabled = false;
      saveBtn.classList.add('btn-primary');
      saveBtn.style.background = '';
      saveBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        Save to Mindora
      `;
    }, 1500);

    await loadRecentItems();
  } catch (err) {
    console.error('Error saving item:', err);
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save to Mindora';
  }
}

async function loadRecentItems() {
  const items = await getItems();
  const recentList = document.getElementById('recent-list');
  const countBadge = document.getElementById('recent-count');

  countBadge.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;

  if (items.length === 0) {
    recentList.innerHTML = `<div class="recent-empty">No saved items yet. Select text on any webpage and save!</div>`;
    return;
  }

  const recentItems = items.slice(0, 3);
  recentList.innerHTML = '';

  recentItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'recent-item';
    const revisitUrl = item.textFragmentUrl || item.sourceUrl;

    el.innerHTML = `
      <div class="recent-item-text">"${escapeHtml(item.selectedText)}"</div>
      <div class="recent-item-meta">
        <a href="${revisitUrl}" target="_blank" class="recent-source-link" title="${escapeHtml(item.pageTitle)}">
          ${escapeHtml(item.sourceDomain || item.pageTitle || 'Source')}
        </a>
        <span>${formatRelativeDate(item.createdAt)}</span>
      </div>
    `;

    recentList.appendChild(el);
  });
}

function openLibrary() {
  chrome.runtime.sendMessage({ action: 'OPEN_LIBRARY' });
  window.close();
}
