# Mindora — Capture Knowledge, Unlock Ideas

> A dependable, fast, local-first Chrome Extension for capturing, organizing, finding, remembering, and using knowledge from the web.

<p align="center">
  <img src="assets/icons/mindora-logo.svg" alt="Mindora Logo" width="96" height="96">
</p>

---

## ✨ Features

- **⚡ One-Click & Shortcut Capture:**
  - Select text on any webpage and right-click **"Save to Mindora"**, or press <kbd>Alt</kbd>+<kbd>S</kbd>.
  - Non-intrusive floating toast confirms capture and lets you add quick notes without leaving your reading flow.
- **📝 Notes & Annotations:**
  - Add personal takeaways, insights, or why an excerpt matters directly from the popup or full library.
- **📂 Collections & Tags:**
  - Group items into projects or subjects (e.g., *Research*, *Engineering*, *Reading List*).
  - Add tag pills (e.g., `#javascript`, `#thesis`) for multi-dimensional filtering.
- **🔍 Instant Keyword Search & Filters:**
  - Sub-50ms client-side search across excerpts, notes, titles, domains, and tags.
  - Press <kbd>/</kbd> anywhere in the library to instantly focus search.
  - Filter by reading status, collection, or tag with real-time counters.
- **🔗 Source Links & Scroll-to-Quote Revisit:**
  - Automatically captures page title, domain, favicon, and canonical URL.
  - Generates Chromium Text Fragment links (`#:~:text=...`) that automatically scroll and highlight the exact quote when you revisit.
- **🚦 Reading Status Pipeline:**
  - Track items through: `Unread` ➔ `In Progress` ➔ `Reviewed` ➔ `Archived`.
- **💾 Full Portability & Backup:**
  - **Export to Markdown:** Clean blockquoted notes ready for Obsidian, Notion, or local storage.
  - **JSON Backup & Restore:** Complete backup and one-click restore with duplicate prevention.
- **🛡️ Exact Duplicate Detection:**
  - Computes a content hash of (URL + Excerpt) to warn if an excerpt has already been captured.
- **🌓 Adaptive Dark & Light Modes:**
  - Complete theme support with high-contrast typography and seamless sync across the library and popup.
- **🔒 100% Local-First & Private:**
  - Zero external servers, zero tracking, and no external API keys required. All data resides safely in your browser's `chrome.storage.local`.

---

## 🚀 Installation (Load Unpacked in Chrome)

1. **Clone or download this repository:**
   ```bash
   git clone https://github.com/<your-username>/mindora.git
   ```
2. Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. In the file picker, select the cloned `Mindora` folder (the root folder containing `manifest.json`).
6. Pin **Mindora** from the Chrome extensions menu (🧩) for one-click access!

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Alt</kbd> + <kbd>S</kbd> | Capture selected text on the active webpage |
| <kbd>Alt</kbd> + <kbd>M</kbd> | Open Mindora quick capture popup |
| <kbd>/</kbd> | Focus search bar inside the Mindora Library |

*(Note: On macOS, shortcuts use <kbd>Option</kbd>+<kbd>S</kbd> / <kbd>Option</kbd>+<kbd>M</kbd>).*

---

## 📁 Project Architecture

```
Mindora/
├── manifest.json              # Chrome Manifest V3 configuration & permissions
├── assets/
│   ├── icons/                 # 16, 32, 48, 128px icons & SVG vector logo
│   └── styles/
│       ├── theme.css          # Color tokens, typography, dark/light theme
│       └── components.css     # Buttons, cards, badges, inputs, modals
├── background/
│   └── service-worker.js      # Context menus, shortcuts, tab communications
├── content/
│   ├── content-script.js      # DOM selection extraction, floating toast UI
│   └── toast.css              # Non-intrusive floating feedback banner
├── popup/
│   ├── popup.html             # Quick capture & recent saves mini-window
│   ├── popup.js               # Capture controller, collection selector, tag manager
│   └── popup.css              # Compact popup stylesheet
├── library/
│   ├── library.html           # Full workspace manager & dashboard
│   ├── library.js             # Real-time search engine, filter ribbon, modals
│   └── library.css            # Responsive dashboard layout
├── lib/
│   ├── storage.js             # chrome.storage.local abstraction layer (CRUD)
│   ├── export.js              # Markdown notes generator & JSON backup/restore
│   └── utils.js               # Hashing, text fragments, domain parser
└── scripts/
    ├── generate_icons.py      # Icon generator script
    └── test_core.js           # Automated test suite
```

---

## 🧪 Testing the Extension

To run the automated logic tests (verifies hashing, duplicate detection, text fragment generation, and Markdown export):

```bash
node scripts/test_core.js
```

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
