/**
 * Mindora Background Service Worker (Manifest V3)
 * Handles context menus, keyboard shortcuts, and inter-component messaging
 */

import { saveItem, updateItem, findDuplicate } from '../lib/storage.js';

// Setup Context Menus upon extension install / update
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    // Context menu on selected text
    chrome.contextMenus.create({
      id: 'mindora-save-selection',
      title: 'Save to Mindora',
      contexts: ['selection']
    });

    // Quick access to library from context menu
    chrome.contextMenus.create({
      id: 'mindora-open-library',
      title: 'Open Mindora Library',
      contexts: ['action', 'page']
    });
  });
});

// Handle Context Menu item clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'mindora-save-selection' && tab && tab.id) {
    const selectedText = (info.selectionText || '').trim();
    if (!selectedText) return;

    try {
      const saveResult = await saveItem({
        selectedText: selectedText,
        pageTitle: tab.title || 'Untitled',
        sourceUrl: tab.url || '',
        faviconUrl: tab.favIconUrl || ''
      });

      const isDuplicate = !!saveResult.duplicate;
      const itemId = isDuplicate ? saveResult.existingItem.id : saveResult.item.id;

      // Notify content script to display visual toast confirmation
      chrome.tabs.sendMessage(tab.id, {
        action: 'SHOW_TOAST',
        payload: {
          selectedText: selectedText,
          itemId: itemId,
          isDuplicate: isDuplicate
        }
      }).catch(() => {
        // Tab might be a chrome:// or restricted page
      });
    } catch (err) {
      console.error('Mindora save error:', err);
    }
  } else if (info.menuItemId === 'mindora-open-library') {
    openLibraryTab();
  }
});

// Handle Keyboard Shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-selection') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    try {
      // Query content script for current selection
      const pageData = await chrome.tabs.sendMessage(tab.id, { action: 'GET_SELECTION_DATA' });
      if (!pageData || !pageData.selectedText) return;

      const saveResult = await saveItem({
        selectedText: pageData.selectedText,
        pageTitle: pageData.pageTitle || tab.title || 'Untitled',
        sourceUrl: pageData.url || tab.url || '',
        faviconUrl: pageData.favicon || tab.favIconUrl || ''
      });

      const isDuplicate = !!saveResult.duplicate;
      const itemId = isDuplicate ? saveResult.existingItem.id : saveResult.item.id;

      chrome.tabs.sendMessage(tab.id, {
        action: 'SHOW_TOAST',
        payload: {
          selectedText: pageData.selectedText,
          itemId: itemId,
          isDuplicate: isDuplicate
        }
      });
    } catch (err) {
      console.error('Command capture failed:', err);
    }
  }
});

// Handle internal messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SAVE_SELECTION_DIRECT') {
    const payload = message.payload || {};
    saveItem({
      selectedText: payload.selectedText,
      pageTitle: payload.pageTitle || sender.tab?.title || 'Untitled',
      sourceUrl: payload.url || sender.tab?.url || '',
      faviconUrl: payload.favicon || sender.tab?.favIconUrl || ''
    }).then(saveResult => {
      const isDuplicate = !!saveResult.duplicate;
      const itemId = isDuplicate ? saveResult.existingItem.id : saveResult.item.id;
      sendResponse({ success: true, isDuplicate, itemId });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.action === 'OPEN_LIBRARY') {
    openLibraryTab();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'UPDATE_ITEM_NOTE') {
    updateItem(message.itemId, { userNote: message.note })
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

function openLibraryTab() {
  const libraryUrl = chrome.runtime.getURL('library/library.html');
  chrome.tabs.query({ url: libraryUrl }, (tabs) => {
    if (tabs && tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
      if (tabs[0].windowId) {
        chrome.windows.update(tabs[0].windowId, { focused: true });
      }
    } else {
      chrome.tabs.create({ url: libraryUrl });
    }
  });
}
