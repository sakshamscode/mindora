/**
 * Mindora Quick Capture Popup Controller
 * Full multi-language UI support & live excerpt translation
 */

import { getItems, getCollections, saveItem, findDuplicate, createCollection } from '../lib/storage.js';
import { formatRelativeDate, escapeHtml, sanitizeUrl } from '../lib/utils.js';
import { getLanguage, setLanguage, applyTranslations, SUPPORTED_LANGUAGES, t } from '../lib/i18n.js';
import { translateText } from '../lib/translator.js';

let currentTab = null;
let currentTags = [];
let currentLang = 'en';
let isTranslationActive = false;
let detectedSourceLang = 'auto';
let translateDebounceTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initPopup();
});

async function initPopup() {
  initTheme();
  await initLanguage();
  setupEventListeners();
  await loadCollections();
  await detectActiveTabAndSelection();
  await loadRecentItems();
}

function initTheme() {
  const savedTheme = localStorage.getItem('mindora_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

async function initLanguage() {
  currentLang = await getLanguage();

  // Populate popup header language picker
  const langSelect = document.getElementById('popup-lang-select');
  langSelect.innerHTML = '';
  SUPPORTED_LANGUAGES.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.code;
    opt.textContent = `${l.nativeName}`;
    if (l.code === currentLang) opt.selected = true;
    langSelect.appendChild(opt);
  });

  // Populate target language picker in translation panel
  const targetSelect = document.getElementById('target-lang-select');
  targetSelect.innerHTML = '';
  SUPPORTED_LANGUAGES.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.code;
    opt.textContent = `${l.nativeName} (${l.name})`;
    if (l.code === currentLang) opt.selected = true;
    targetSelect.appendChild(opt);
  });

  // Apply localized text across all popup elements
  applyTranslations(document, currentLang);
}

function setupEventListeners() {
  // Language switcher in header
  document.getElementById('popup-lang-select').addEventListener('change', async (e) => {
    currentLang = await setLanguage(e.target.value);
    applyTranslations(document, currentLang);
    // Also update target translation language if not manually changed
    document.getElementById('target-lang-select').value = currentLang;
    if (isTranslationActive) {
      triggerLiveTranslation();
    }
  });

  // Save button
  document.getElementById('save-btn').addEventListener('click', handleSave);

  // Library buttons
  document.getElementById('open-library-btn').addEventListener('click', openLibrary);
  document.getElementById('footer-library-btn').addEventListener('click', openLibrary);

  // New collection button
  document.getElementById('new-collection-btn').addEventListener('click', handleNewCollection);

  // Translation Panel Toggle
  const toggleTransBtn = document.getElementById('toggle-translate-btn');
  const transPanel = document.getElementById('translation-panel');

  toggleTransBtn.addEventListener('click', () => {
    isTranslationActive = !isTranslationActive;
    transPanel.style.display = isTranslationActive ? 'flex' : 'none';
    toggleTransBtn.classList.toggle('active', isTranslationActive);

    const saveText = document.getElementById('save-btn-text');
    saveText.textContent = isTranslationActive
      ? t('save_and_translate', currentLang)
      : t('save_to_mindora', currentLang);

    if (isTranslationActive) {
      triggerLiveTranslation();
    }
  });

  // Target translation language changed
  document.getElementById('target-lang-select').addEventListener('change', () => {
    triggerLiveTranslation();
  });

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

  // Excerpt input changed
  document.getElementById('excerpt-input').addEventListener('input', async (e) => {
    const text = e.target.value.trim();
    if (currentTab && currentTab.url) {
      const dup = text ? await findDuplicate(currentTab.url, text) : null;
      toggleDuplicateBanner(!!dup);
    }
    if (isTranslationActive) {
      clearTimeout(translateDebounceTimer);
      translateDebounceTimer = setTimeout(() => triggerLiveTranslation(), 400);
    }
  });
}

async function triggerLiveTranslation() {
  const excerptInput = document.getElementById('excerpt-input');
  const transOutput = document.getElementById('translated-output');
  const loader = document.getElementById('trans-loading-indicator');
  const badge = document.getElementById('detected-lang-badge');
  const targetLang = document.getElementById('target-lang-select').value;

  const text = excerptInput.value.trim();
  if (!text) {
    transOutput.value = '';
    badge.textContent = 'Auto';
    return;
  }

  loader.style.display = 'flex';

  try {
    const res = await translateText(text, targetLang);
    transOutput.value = res.translatedText;
    detectedSourceLang = res.sourceLang || 'auto';
    badge.textContent = t('detected_lang', currentLang, { lang: detectedSourceLang.toUpperCase() });
  } catch (err) {
    console.warn('Live translation error:', err);
  } finally {
    loader.style.display = 'none';
  }
}

async function detectActiveTabAndSelection() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;

    currentTab = tabs[0];

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

        // If translation is active, translate selection immediately
        if (isTranslationActive) {
          triggerLiveTranslation();
        }
      }
    } catch (e) {
      // Content script may not be loaded on restricted pages
    }
  } catch (err) {
    console.error('Active tab detection error:', err);
  }
}

async function loadCollections(selectedId = null) {
  const collections = await getCollections();
  const select = document.getElementById('collection-select');

  select.innerHTML = `<option value="">${escapeHtml(t('general_collection', currentLang))}</option>`;

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
  const name = prompt(t('prompt_collection_name', currentLang));
  if (!name || !name.trim()) return;

  const newCol = await createCollection(name.trim());
  await loadCollections(newCol.id);
}

async function handleSave() {
  const saveBtn = document.getElementById('save-btn');
  const saveText = document.getElementById('save-btn-text');
  const excerptInput = document.getElementById('excerpt-input');
  const noteInput = document.getElementById('note-input');
  const collectionSelect = document.getElementById('collection-select');
  const statusSelect = document.getElementById('status-select');
  const transOutput = document.getElementById('translated-output');
  const targetSelect = document.getElementById('target-lang-select');

  const excerpt = excerptInput.value.trim();
  if (!excerpt && (!currentTab || !currentTab.title)) {
    excerptInput.focus();
    return;
  }

  saveBtn.disabled = true;
  saveText.textContent = t('saving', currentLang);

  const translatedText = isTranslationActive ? transOutput.value.trim() : '';

  try {
    const savePayload = {
      selectedText: excerpt || `Saved page bookmark: ${currentTab?.title || 'Webpage'}`,
      userNote: noteInput.value.trim(),
      pageTitle: currentTab?.title || 'Untitled',
      sourceUrl: currentTab?.url || '',
      faviconUrl: currentTab?.favIconUrl || '',
      collectionId: collectionSelect.value || null,
      status: statusSelect.value || 'unread',
      tags: [...currentTags],
      isTranslated: isTranslationActive && !!translatedText,
      translatedText: translatedText,
      sourceLanguage: detectedSourceLang,
      targetLanguage: isTranslationActive ? targetSelect.value : ''
    };

    await saveItem(savePayload, true);

    saveBtn.classList.remove('btn-primary');
    saveBtn.style.background = '#10B981';
    saveBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>${escapeHtml(t('saved', currentLang))}</span>
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
        <span id="save-btn-text">${escapeHtml(isTranslationActive ? t('save_and_translate', currentLang) : t('save_to_mindora', currentLang))}</span>
      `;
    }, 1500);

    await loadRecentItems();
  } catch (err) {
    console.error('Error saving item:', err);
    saveBtn.disabled = false;
    saveText.textContent = t('save_to_mindora', currentLang);
  }
}

async function loadRecentItems() {
  const items = await getItems();
  const recentList = document.getElementById('recent-list');
  const countBadge = document.getElementById('recent-count');

  countBadge.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;

  if (items.length === 0) {
    recentList.innerHTML = `<div class="recent-empty">${escapeHtml(t('no_recent_items', currentLang))}</div>`;
    return;
  }

  const recentItems = items.slice(0, 3);
  recentList.innerHTML = '';

  recentItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'recent-item';
    const revisitUrl = sanitizeUrl(item.textFragmentUrl || item.sourceUrl);

    const hasTranslation = item.isTranslated && item.translatedText;
    const transBadge = hasTranslation
      ? `<span style="font-size:10px;color:#818CF8;font-weight:600;margin-left:4px;">[🌐 ${escapeHtml((item.targetLanguage || '').toUpperCase())}]</span>`
      : '';

    el.innerHTML = `
      <div class="recent-item-text">"${escapeHtml(hasTranslation ? item.translatedText : item.selectedText)}" ${transBadge}</div>
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
