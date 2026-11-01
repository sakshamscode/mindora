/**
 * Mindora Content Script
 * Handles text selection extraction, floating multi-action quick save/translate pill, and interactive toast notifications
 */

// Helper to get active text selection
function getSelectedText() {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : '';
}

// Helper to get canonical or current URL
function getBestUrl() {
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical && canonical.href) {
    return canonical.href;
  }
  return window.location.href;
}

// Helper to get favicon
function getFavicon() {
  const iconLink = document.querySelector('link[rel~="icon"]');
  return iconLink ? iconLink.href : `${window.location.origin}/favicon.ico`;
}

// Quick UI dictionary fallback for content script
const CONTENT_I18N = {
  en: { save: "Save to Mindora", translate: "Translate & Save", saved: "Saved!", translating: "Translating...", original: "Original", translated: "Translated" },
  hi: { save: "मिन्दोरा में सहेजें", translate: "अनुवाद और सहेजें", saved: "सहेज लिया गया!", translating: "अनुवाद हो रहा है...", original: "मूल पाठ", translated: "अनुवाद" },
  es: { save: "Guardar en Mindora", translate: "Traducir y guardar", saved: "¡Guardado!", translating: "Traduciendo...", original: "Original", translated: "Traducido" },
  fr: { save: "Enregistrer dans Mindora", translate: "Traduire et enregistrer", saved: "Enregistré !", translating: "Traduction...", original: "Original", translated: "Traduit" },
  de: { save: "In Mindora speichern", translate: "Übersetzen & Speichern", saved: "Gespeichert!", translating: "Wird übersetzt...", original: "Original", translated: "Übersetzt" },
  ja: { save: "Mindoraに保存", translate: "翻訳して保存", saved: "保存完了！", translating: "翻訳中...", original: "原文", translated: "翻訳文" },
  zh: { save: "保存到 Mindora", translate: "翻译并保存", saved: "已保存！", translating: "正在翻译...", original: "原文", translated: "译文" },
  ar: { save: "حفظ في ميندورا", translate: "ترجمة وحفظ", saved: "تم الحفظ!", translating: "جارٍ الترجمة...", original: "الأصل", translated: "المترجم" },
  ru: { save: "Сохранить в Mindora", translate: "Перевести и сохранить", saved: "Сохранено!", translating: "Перевод...", original: "Оригинал", translated: "Перевод" },
  pt: { save: "Salvar no Mindora", translate: "Traduzir e salvar", saved: "Salvo!", translating: "Traduzindo...", original: "Original", translated: "Traduzido" }
};

// Check if extension context is valid (protects against reload orphan states)
function isExtensionValid() {
  try {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

let userLang = 'en';
try {
  if (isExtensionValid() && chrome.storage?.local) {
    chrome.storage.local.get(['mindora_language'], (res) => {
      if (chrome.runtime?.lastError) return;
      if (res && res.mindora_language) userLang = res.mindora_language;
    });
  }
} catch (e) {}

function getI18n(key) {
  const dict = CONTENT_I18N[userLang] || CONTENT_I18N.en;
  return dict[key] || CONTENT_I18N.en[key] || key;
}

// ==========================================
// Floating Selection Quick-Save Button Logic
// ==========================================

let isMouseDown = false;

document.addEventListener('mousedown', (e) => {
  isMouseDown = true;
  const group = document.getElementById('mindora-floating-group');
  if (group && (e.target === group || group.contains(e.target))) {
    return; // Don't remove if clicking inside the pill
  }
  removeFloatingButton();
});

document.addEventListener('mouseup', (e) => {
  isMouseDown = false;
  // If right click, ignore (preserve native context menu)
  if (e.button && e.button !== 0) return;
  handleTextSelection(e);
});

document.addEventListener('keyup', (e) => {
  // If user used Shift+Arrow keys to select text
  if (['Shift', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    handleTextSelection(e);
  }
});

window.addEventListener('scroll', () => {
  removeFloatingButton();
}, { passive: true });

function handleTextSelection(e) {
  if (!isExtensionValid()) return;
  const group = document.getElementById('mindora-floating-group');
  if (group && e && e.target && group.contains(e.target)) return;

  const toastRoot = document.getElementById('mindora-toast-root');
  if (toastRoot && e && e.target && toastRoot.contains(e.target)) return;

  setTimeout(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      removeFloatingButton();
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) {
      removeFloatingButton();
      return;
    }

    // Don't show inside inputs / textareas / contenteditables where user is typing
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      removeFloatingButton();
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      removeFloatingButton();
      return;
    }

    showFloatingButton(rect, text);
  }, 20);
}

function showFloatingButton(rect, text) {
  let group = document.getElementById('mindora-floating-group');
  if (!group) {
    group = document.createElement('div');
    group.id = 'mindora-floating-group';
    document.body.appendChild(group);
  }

  // Refresh language setting
  if (isExtensionValid() && chrome.storage?.local) {
    try {
      chrome.storage.local.get(['mindora_language'], (res) => {
        if (!isExtensionValid() || chrome.runtime?.lastError) return;
        if (res && res.mindora_language) userLang = res.mindora_language;
      });
    } catch (e) {}
  }

  const saveLabel = getI18n('save');
  const transLabel = getI18n('translate');

  group.innerHTML = `
    <button class="mindora-floating-action-btn" id="mindora-btn-save" title="Save original excerpt">
      <span class="mindora-floating-icon">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L10 6L15 8L10 10L8 15L6 10L1 8L6 6L8 1Z" fill="#818CF8"/>
        </svg>
      </span>
      <span>${escapeText(saveLabel)}</span>
    </button>
    <span class="mindora-floating-divider"></span>
    <button class="mindora-floating-action-btn secondary" id="mindora-btn-translate" title="Translate excerpt to ${escapeText(userLang.toUpperCase())} and save">
      <span class="mindora-floating-icon">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      </span>
      <span>${escapeText(transLabel)}</span>
    </button>
  `;

  const btnSave = group.querySelector('#mindora-btn-save');
  const btnTranslate = group.querySelector('#mindora-btn-translate');

  // Normal Save
  btnSave.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();

    if (!isExtensionValid()) {
      alert('Mindora extension was updated. Please refresh this webpage to use the latest version.');
      removeFloatingButton();
      return;
    }

    btnSave.innerHTML = `
      <span class="mindora-floating-icon">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M3 8.5L6.5 12L13 4" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span style="color:#34D399;">${escapeText(getI18n('saved'))}</span>
    `;

    try {
      chrome.runtime.sendMessage({
        action: 'SAVE_SELECTION_DIRECT',
        payload: {
          selectedText: text,
          pageTitle: document.title || 'Untitled Page',
          url: getBestUrl(),
          favicon: getFavicon()
        }
      }, (response) => {
        if (!isExtensionValid() || chrome.runtime?.lastError) return;
        if (response && response.success) {
          renderToast({
            selectedText: text,
            itemId: response.itemId,
            isDuplicate: response.isDuplicate
          });
        }
        setTimeout(() => removeFloatingButton(), 300);
      });
    } catch (e) {
      removeFloatingButton();
    }
  });

  // Translate & Save
  btnTranslate.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();

    if (!isExtensionValid()) {
      alert('Mindora extension was updated. Please refresh this webpage to use the latest version.');
      removeFloatingButton();
      return;
    }

    btnTranslate.innerHTML = `
      <span class="mindora-floating-icon">⏳</span>
      <span style="color:#C7D2FE;">${escapeText(getI18n('translating'))}</span>
    `;

    try {
      chrome.runtime.sendMessage({
        action: 'TRANSLATE_TEXT',
        text: text,
        targetLang: userLang
      }, (transRes) => {
        if (!isExtensionValid() || chrome.runtime?.lastError) return;
        const translation = (transRes && transRes.success && transRes.result) ? transRes.result : null;
        const translatedText = translation ? translation.translatedText : '';
        const sourceLang = translation ? translation.sourceLang : '';

        try {
          chrome.runtime.sendMessage({
            action: 'SAVE_SELECTION_DIRECT',
            payload: {
              selectedText: text,
              pageTitle: document.title || 'Untitled Page',
              url: getBestUrl(),
              favicon: getFavicon(),
              isTranslated: !!translatedText,
              translatedText: translatedText,
              sourceLanguage: sourceLang,
              targetLanguage: userLang
            }
          }, (response) => {
            if (!isExtensionValid() || chrome.runtime?.lastError) return;
            btnTranslate.innerHTML = `
              <span class="mindora-floating-icon">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5L6.5 12L13 4" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span style="color:#34D399;">${escapeText(getI18n('saved'))}</span>
            `;

            if (response && response.success) {
              renderToast({
                selectedText: text,
                translatedText: translatedText,
                sourceLanguage: sourceLang,
                targetLanguage: userLang,
                isTranslated: !!translatedText,
                itemId: response.itemId,
                isDuplicate: response.isDuplicate
              });
            }
            setTimeout(() => removeFloatingButton(), 300);
          });
        } catch (e) {
          removeFloatingButton();
        }
      });
    } catch (e) {
      removeFloatingButton();
    }
  });

  // Position calculation
  const btnWidth = 260;
  const btnHeight = 34;

  let top = rect.top - btnHeight - 8;
  let left = rect.left + (rect.width / 2) - (btnWidth / 2);

  if (top < 10) {
    top = rect.bottom + 8;
  }

  if (left < 10) left = 10;
  if (left + btnWidth > window.innerWidth - 10) {
    left = window.innerWidth - btnWidth - 10;
  }

  group.style.top = `${Math.round(top)}px`;
  group.style.left = `${Math.round(left)}px`;
  group.classList.add('visible');
}

function removeFloatingButton() {
  const group = document.getElementById('mindora-floating-group');
  if (group) {
    group.classList.remove('visible');
    setTimeout(() => {
      if (group && !group.classList.contains('visible') && group.parentNode) {
        group.parentNode.removeChild(group);
      }
    }, 180);
  }
}

// Listen for background requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_SELECTION_DATA') {
    sendResponse({
      selectedText: getSelectedText(),
      pageTitle: document.title || 'Untitled Page',
      url: getBestUrl(),
      favicon: getFavicon()
    });
    return true;
  }

  if (request.action === 'SHOW_TOAST') {
    renderToast(request.payload);
    sendResponse({ received: true });
    return true;
  }
});

/**
 * Render non-intrusive floating toast notification with translation preview
 */
function renderToast(data) {
  let root = document.getElementById('mindora-toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'mindora-toast-root';
    document.body.appendChild(root);
  }

  root.innerHTML = '';

  const toast = document.createElement('div');
  toast.className = 'mindora-toast-card';

  const isDuplicate = data.isDuplicate;
  const statusTitle = isDuplicate ? 'Already in Mindora' : 'Saved to Mindora';
  const statusColor = isDuplicate ? '#F59E0B' : '#10B981';

  const hasTranslation = data.isTranslated && data.translatedText;
  const langBadge = hasTranslation 
    ? `<span class="mindora-toast-trans-tag">${escapeText(data.sourceLanguage || 'auto')} ➔ ${escapeText(data.targetLanguage || userLang)}</span>`
    : '';

  const tabsHtml = hasTranslation
    ? `<div class="mindora-toast-tabs">
         <button class="mindora-toast-tab-btn active" id="tab-translated">${escapeText(getI18n('translated'))}</button>
         <button class="mindora-toast-tab-btn" id="tab-original">${escapeText(getI18n('original'))}</button>
       </div>`
    : '';

  const displayText = (hasTranslation ? data.translatedText : data.selectedText) || '';

  toast.innerHTML = `
    <div class="mindora-toast-header">
      <div class="mindora-toast-badge">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="${statusColor}"/>
          <path d="M5 8.5L7 10.5L11 5.5" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>${escapeText(statusTitle)}</span>
        ${langBadge}
      </div>
      <button class="mindora-toast-close" id="mindora-toast-close-btn">&times;</button>
    </div>

    <div class="mindora-toast-body">
      ${tabsHtml}
      <div class="mindora-toast-excerpt" id="mindora-toast-text">
        "${escapeText(displayText)}"
      </div>
    </div>

    <div id="mindora-toast-note-container"></div>

    <div class="mindora-toast-actions">
      ${!hasTranslation ? `<button class="mindora-toast-btn" id="mindora-toast-translate-btn">🌐 ${escapeText(getI18n('translate'))}</button>` : ''}
      <button class="mindora-toast-btn" id="mindora-toast-note-toggle">+ Note</button>
      <button class="mindora-toast-btn mindora-toast-btn-primary" id="mindora-toast-library-btn">Open Library</button>
    </div>
  `;

  root.appendChild(toast);

  const closeBtn = toast.querySelector('#mindora-toast-close-btn');
  const noteToggle = toast.querySelector('#mindora-toast-note-toggle');
  const libraryBtn = toast.querySelector('#mindora-toast-library-btn');
  const noteContainer = toast.querySelector('#mindora-toast-note-container');
  const toastText = toast.querySelector('#mindora-toast-text');

  let autoDismissTimer = setTimeout(() => {
    dismissToast(toast);
  }, 5000);

  // Tab switching between Original and Translated
  if (hasTranslation) {
    const tabTrans = toast.querySelector('#tab-translated');
    const tabOrig = toast.querySelector('#tab-original');

    tabTrans.addEventListener('click', () => {
      tabTrans.classList.add('active');
      tabOrig.classList.remove('active');
      toastText.textContent = `"${data.translatedText}"`;
    });

    tabOrig.addEventListener('click', () => {
      tabOrig.classList.add('active');
      tabTrans.classList.remove('active');
      toastText.textContent = `"${data.selectedText}"`;
    });
  }

  // Translate directly from toast if saved as original
  const toastTransBtn = toast.querySelector('#mindora-toast-translate-btn');
  if (toastTransBtn) {
    toastTransBtn.addEventListener('click', () => {
      clearTimeout(autoDismissTimer);
      if (!isExtensionValid()) return;
      toastTransBtn.textContent = 'Translating...';
      toastTransBtn.disabled = true;

      try {
        chrome.runtime.sendMessage({
          action: 'TRANSLATE_TEXT',
          text: data.selectedText,
          targetLang: userLang
        }, (res) => {
          if (!isExtensionValid() || chrome.runtime?.lastError) return;
          if (res && res.success && res.result) {
            const trans = res.result;
            data.isTranslated = true;
            data.translatedText = trans.translatedText;
            data.sourceLanguage = trans.sourceLang;
            data.targetLanguage = trans.targetLang;

            if (data.itemId) {
              try {
                chrome.runtime.sendMessage({
                  action: 'SAVE_SELECTION_DIRECT',
                  payload: {
                    id: data.itemId,
                    selectedText: data.selectedText,
                    translatedText: trans.translatedText,
                    isTranslated: true,
                    sourceLanguage: trans.sourceLang,
                    targetLanguage: trans.targetLang
                  }
                });
              } catch (e) {}
            }

            renderToast(data);
          }
        });
      } catch (e) {}
    });
  }

  closeBtn.addEventListener('click', () => {
    clearTimeout(autoDismissTimer);
    dismissToast(toast);
  });

  libraryBtn.addEventListener('click', () => {
    clearTimeout(autoDismissTimer);
    if (!isExtensionValid()) return;
    try {
      chrome.runtime.sendMessage({ action: 'OPEN_LIBRARY' });
    } catch (e) {}
    dismissToast(toast);
  });

  noteToggle.addEventListener('click', () => {
    clearTimeout(autoDismissTimer);
    noteToggle.style.display = 'none';

    noteContainer.innerHTML = `
      <div class="mindora-toast-note-box">
        <input type="text" class="mindora-toast-input" id="mindora-inline-note-input" placeholder="Type quick takeaway and press Enter..." />
      </div>
    `;

    const noteInput = noteContainer.querySelector('#mindora-inline-note-input');
    noteInput.focus();

    noteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const noteVal = noteInput.value.trim();
        if (noteVal && data.itemId) {
          if (!isExtensionValid()) return;
          try {
            chrome.runtime.sendMessage({
              action: 'UPDATE_ITEM_NOTE',
              itemId: data.itemId,
              note: noteVal
            });
            noteContainer.innerHTML = `<span style="font-size:11px;color:#34D399;">${escapeText(getI18n('note_saved'))}</span>`;
            setTimeout(() => dismissToast(toast), 1200);
          } catch (e) {}
        }
      }
    });
  });
}

function dismissToast(toast) {
  toast.classList.add('hide');
  setTimeout(() => {
    const root = document.getElementById('mindora-toast-root');
    if (root && root.contains(toast)) {
      root.removeChild(toast);
    }
  }, 250);
}

function escapeText(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return m;
    }
  });
}

function safeUrl(url) {
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
