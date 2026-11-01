# Mindora — Capture Knowledge, Unlock Ideas

> A dependable, fast, local-first Chrome Extension for capturing, organizing, finding, remembering, and using knowledge from the web.

<p align="center">
  <img src="assets/icons/mindora-logo.svg" alt="Mindora Logo" width="96" height="96"><br>
  <img src="https://img.shields.io/badge/version-1.1.0-6366F1?style=flat-square" alt="Version 1.1.0">
  <img src="https://img.shields.io/badge/manifest-v3-10B981?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/license-MIT-3B82F6?style=flat-square" alt="MIT License">
  <img src="https://img.shields.io/badge/languages-10-8B5CF6?style=flat-square" alt="10 Languages">
</p>

---

## ✨ Features

- **🌐 Zero-Cost Excerpt Translation & Dual-Language View:**
  - Highlight text in any language (e.g. Japanese, German, Spanish, French, Hindi) and click **`🌐 Translate & Save`** on the floating pill or popup.
  - Automatically detects the source language and translates to your desired language with **₹0 / $0 API cost** (no API keys or accounts required).
  - Every card in your library features an instant toggle: **`[ 📄 Original | 🌐 Translated ]`** to switch views seamlessly.
  - Multi-language search allows finding notes by typing keywords in *either* the original or translated language!
- **🌍 Full Multi-Language UI (10 Languages):**
  - Switch the entire extension interface (all buttons, navigation views, labels, placeholders, modals, and toasts) into your desired language via the in-app language picker:
    **English**, **हिन्दी (Hindi)**, **Español (Spanish)**, **Français (French)**, **Deutsch (German)**, **日本語 (Japanese)**, **简体中文 (Chinese)**, **العربية (Arabic)**, **Русский (Russian)**, or **Português (Portuguese)**.
  - 100% offline, zero-latency UI localization.
- **⚡ Instant 1-Click Floating Capture & Shortcuts:**
  - **Floating Quick-Save Button:** Highlight any text with your mouse and a sleek **`✦ Save to Mindora | 🌐 Translate`** pill immediately appears right above your selection. Click once to save or translate!
  - **Context Menu & Shortcut:** Right-click **"Save to Mindora"** or press <kbd>Alt</kbd>+<kbd>S</kbd> anytime.
  - **Instant Feedback:** Non-intrusive floating toast confirms capture and lets you add quick notes without leaving your reading flow.
- **📝 Notes & Annotations:**
  - Add personal takeaways, insights, or why an excerpt matters directly from the popup, toast, or full library.
- **📂 Collections & Tags:**
  - Group items into projects or subjects (e.g., *Research*, *Engineering*, *Reading List*).
  - Add tag pills (e.g., `#javascript`, `#thesis`) for multi-dimensional filtering.
- **🔍 Instant Keyword Search & Filters:**
  - Sub-50ms client-side search across original excerpts, translations, notes, titles, domains, and tags.
  - Press <kbd>/</kbd> anywhere in the library to instantly focus search.
  - Filter by reading status, collection, original language, or tag with real-time counters.
- **🔗 Source Links & Scroll-to-Quote Revisit:**
  - Automatically captures page title, domain, favicon, and canonical URL.
  - Generates Chromium Text Fragment links (`#:~:text=...`) that automatically scroll and highlight the exact quote when you revisit.
- **🚦 Reading Status Pipeline:**
  - Track items through: `Unread` ➔ `In Progress` ➔ `Reviewed` ➔ `Archived`.
- **💾 Full Portability & Backup:**
  - **Export to Markdown:** Clean blockquoted notes with both original and translated excerpts ready for Obsidian, Notion, or local storage.
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
├── manifest.json              # Chrome Manifest V3 configuration & permissions (v1.1.0)
├── CHANGELOG.md               # Chronological release notes & version history
├── assets/
│   ├── icons/                 # 16, 32, 48, 128px icons & SVG vector logo
│   └── styles/
│       ├── theme.css          # Color tokens, typography, dark/light theme
│       └── components.css     # Buttons, cards, badges, inputs, modals
├── background/
│   └── service-worker.js      # Context menus, shortcuts, translation router
├── content/
│   ├── content-script.js      # DOM selection extraction, floating pill, toast UI
│   └── toast.css              # Non-intrusive floating feedback banner
├── popup/
│   ├── popup.html             # Quick capture & recent saves mini-window
│   ├── popup.js               # Capture controller, live translation, tag manager
│   └── popup.css              # Compact popup stylesheet
├── library/
│   ├── library.html           # Full workspace manager & dashboard
│   ├── library.js             # Dual-language cards, real-time search, modals
│   └── library.css            # Responsive dashboard layout
├── lib/
│   ├── i18n.js                # 10-language UI localization dictionary & switcher
│   ├── translator.js          # Zero-cost content translation engine & cache
│   ├── storage.js             # chrome.storage.local abstraction layer (CRUD)
│   ├── export.js              # Markdown notes generator & JSON backup/restore
│   └── utils.js               # Hashing, text fragments, domain parser
└── scripts/
    ├── generate_icons.py      # Icon generator script
    └── test_core.js           # Automated test suite
```

---

## 🧪 Testing the Extension

To run the automated test suite (verifying hashing, duplicate detection, text fragments, XSS/injection security sanitizers, 10-language i18n, translation parsing, and Markdown export):

```bash
node scripts/test_core.js
```

---

## 📜 Changelog

Detailed release history and security updates are documented in [CHANGELOG.md](CHANGELOG.md).

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
