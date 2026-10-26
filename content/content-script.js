/**
 * Mindora Content Script
 * Handles text selection extraction and floating toast notifications
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

// ==========================================
// Floating Selection Quick-Save Button Logic
// ==========================================

let isMouseDown = false;

document.addEventListener('mousedown', (e) => {
  isMouseDown = true;
  const floatingBtn = document.getElementById('mindora-floating-save-btn');
  if (floatingBtn && (e.target === floatingBtn || floatingBtn.contains(e.target))) {
    return; // Don't remove if clicking the button itself
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
  // Ignore clicks inside our own floating button or toast
  const floatingBtn = document.getElementById('mindora-floating-save-btn');
  if (floatingBtn && e && e.target && floatingBtn.contains(e.target)) return;

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
  let btn = document.getElementById('mindora-floating-save-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'mindora-floating-save-btn';
    btn.className = 'mindora-floating-save-btn';
    btn.innerHTML = `
      <span class="mindora-floating-icon">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L10 6L15 8L10 10L8 15L6 10L1 8L6 6L8 1Z" fill="#818CF8"/>
        </svg>
      </span>
      <span>Save to Mindora</span>
    `;
    document.body.appendChild(btn);

    // Click handler for floating button
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const capturedText = btn.dataset.selectedText || text;
      if (!capturedText) return;

      // Animate to saved state
      btn.innerHTML = `
        <span class="mindora-floating-icon">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5L6.5 12L13 4" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span style="color:#34D399;">Saved!</span>
      `;

      chrome.runtime.sendMessage({
        action: 'SAVE_SELECTION_DIRECT',
        payload: {
          selectedText: capturedText,
          pageTitle: document.title || 'Untitled Page',
          url: getBestUrl(),
          favicon: getFavicon()
        }
      }, (response) => {
        if (response && response.success) {
          renderToast({
            selectedText: capturedText,
            itemId: response.itemId,
            isDuplicate: response.isDuplicate
          });
        }
        setTimeout(() => removeFloatingButton(), 350);
      });
    });
  } else {
    // Reset contents if it was previously showing "Saved!"
    btn.innerHTML = `
      <span class="mindora-floating-icon">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L10 6L15 8L10 10L8 15L6 10L1 8L6 6L8 1Z" fill="#818CF8"/>
        </svg>
      </span>
      <span>Save to Mindora</span>
    `;
  }

  btn.dataset.selectedText = text;

  // Viewport-relative positioning
  const btnWidth = 148;
  const btnHeight = 32;

  let top = rect.top - btnHeight - 8;
  let left = rect.left + (rect.width / 2) - (btnWidth / 2);

  // If too close to top of viewport, position right below the selection
  if (top < 10) {
    top = rect.bottom + 8;
  }

  // Constrain horizontally within viewport
  if (left < 10) left = 10;
  if (left + btnWidth > window.innerWidth - 10) {
    left = window.innerWidth - btnWidth - 10;
  }

  btn.style.top = `${Math.round(top)}px`;
  btn.style.left = `${Math.round(left)}px`;
  btn.classList.add('visible');
}

function removeFloatingButton() {
  const btn = document.getElementById('mindora-floating-save-btn');
  if (btn) {
    btn.classList.remove('visible');
    setTimeout(() => {
      if (btn && !btn.classList.contains('visible') && btn.parentNode) {
        btn.parentNode.removeChild(btn);
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
 * Render non-intrusive floating toast notification
 */
function renderToast(data) {
  let root = document.getElementById('mindora-toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'mindora-toast-root';
    document.body.appendChild(root);
  }

  // Remove existing toast if present
  root.innerHTML = '';

  const toast = document.createElement('div');
  toast.className = 'mindora-toast-card';

  const isDuplicate = data.isDuplicate;
  const statusTitle = isDuplicate ? 'Already in Mindora' : 'Saved to Mindora';
  const statusColor = isDuplicate ? '#F59E0B' : '#10B981';

  toast.innerHTML = `
    <div class="mindora-toast-header">
      <div class="mindora-toast-badge">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill="${statusColor}"/>
          <path d="M5 8.5L7 10.5L11 5.5" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>${statusTitle}</span>
      </div>
      <button class="mindora-toast-close" id="mindora-toast-close-btn">&times;</button>
    </div>
    <div class="mindora-toast-excerpt">
      "${escapeText(data.selectedText)}"
    </div>
    <div id="mindora-toast-note-container"></div>
    <div class="mindora-toast-actions">
      <button class="mindora-toast-btn" id="mindora-toast-note-toggle">+ Note</button>
      <button class="mindora-toast-btn mindora-toast-btn-primary" id="mindora-toast-library-btn">Open Library</button>
    </div>
  `;

  root.appendChild(toast);

  // Close button
  const closeBtn = toast.querySelector('#mindora-toast-close-btn');
  const noteToggle = toast.querySelector('#mindora-toast-note-toggle');
  const libraryBtn = toast.querySelector('#mindora-toast-library-btn');
  const noteContainer = toast.querySelector('#mindora-toast-note-container');

  let autoDismissTimer = setTimeout(() => {
    dismissToast(toast);
  }, 4500);

  closeBtn.addEventListener('click', () => {
    clearTimeout(autoDismissTimer);
    dismissToast(toast);
  });

  libraryBtn.addEventListener('click', () => {
    clearTimeout(autoDismissTimer);
    chrome.runtime.sendMessage({ action: 'OPEN_LIBRARY' });
    dismissToast(toast);
  });

  noteToggle.addEventListener('click', () => {
    clearTimeout(autoDismissTimer); // keep open while editing note
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
          chrome.runtime.sendMessage({
            action: 'UPDATE_ITEM_NOTE',
            itemId: data.itemId,
            note: noteVal
          });
          noteContainer.innerHTML = `<span style="font-size:11px;color:#34D399;">Note saved!</span>`;
          setTimeout(() => dismissToast(toast), 1200);
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
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => {
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
