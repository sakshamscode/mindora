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
