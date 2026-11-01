# Changelog

All notable changes to the **Mindora** Chrome extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-11-01

### Added
- **10-Language UI Localization:** Full interface localization across English, हिन्दी (Hindi), Español (Spanish), Français (French), Deutsch (German), 日本語 (Japanese), 简体中文 (Chinese), العربية (Arabic), Русский (Russian), and Português (Portuguese).
- **In-App Language Switcher:** Dropdown picker in both the Library workspace sidebar and Quick Capture popup for instant offline language switching.
- **Zero-Cost Content Translation:** Integrated translation pipeline (`lib/translator.js`) with zero API costs, zero external credentials, and automatic source language detection.
- **Dual-Action Floating Pill:** Enhanced floating selection overlay with dual action buttons: **"✦ Save to Mindora"** and **"🌐 Translate & Save"**.
- **Dual-Language Card Views:** Instant card toggle (`[ 📄 Original | 🌐 Translated ]`) on library items to seamlessly switch between captured excerpts and translations.
- **Dual-Language Toast Feedback:** Toast notification banners now include instant tabs to inspect original vs. translated captures.
- **Language Filtering & Cross-Language Search:** New Language cloud filter in the library sidebar; search query matching now searches across both original text and translated output simultaneously.
- **Dual-Language Markdown Export:** Generated Markdown notes now include structured blockquotes for both original passage and translated text with language tags.

### Security
- **URL Protocol Sanitization (`sanitizeUrl`):** Blocks `javascript:`, `data:`, and `vbscript:` pseudo-protocol injection in all clickable links (`sourceUrl`, `revisitUrl`, `textFragmentUrl`).
- **XSS-Safe Search Highlighting (`safeHighlightHtml`):** Token-based raw text splitting and individual segment escaping that prevents HTML entity collisions (e.g. searching `amp` inside `&amp;`) and stops DOM injection.
- **CSS Style Injection Prevention (`sanitizeColor`):** Strict hex color validation (`/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/`) preventing CSS attribute breakout and data exfiltration.
- **Hardened JSON Backup Import (`importFromJSON`):** Added schema verification and field-level sanitization to reject corrupted or poisoned backup files before writing to `chrome.storage.local`.
- **Attribute Breakout Protection:** Applied `escapeHtml()` and `sanitizeId()` across all HTML element attributes (`data-item-id`, `data-col-id`, `select` values).
- **Favicon URL Sanitization (`sanitizeFaviconUrl`):** Blocks malicious SVG data URIs (`data:image/svg+xml`) in favicon tags.
- **Universal HTML Escaper:** Upgraded `escapeHtml()` to pure string entity replacement, ensuring consistent security in Browser DOM, Service Worker, and Node.js testing environments.

### Fixed
- **Extension Context Invalidation Guard:** Added `isExtensionValid()` lifecycle check in content scripts to handle extension reload events gracefully without uncaught exceptions.
- **Manifest V3 CSP Compliance:** Removed inline `onerror` attribute from favicon `<img>` templates and replaced it with JavaScript event listeners.

---

## [1.0.1] - 2026-10-27

### Added
- **Floating Quick-Save Pill:** Interactive overlay (`#mindora-floating-group`) appearing directly above mouse text selections for immediate 1-click capture.
- **Interactive Feedback Toast:** Non-intrusive bottom-right toast banner with inline personal takeaway note input and direct library navigation.
- **Automatic Pill Dismissal:** Smart dismiss logic on scroll, click-outside, and input element detection.

---

## [1.0.0] - 2026-10-26

### Added
- **Initial Production Release (MVP):**
  - **Local-First Architecture:** Complete data persistence inside `chrome.storage.local` with zero tracking, zero external telemetry, and 100% user privacy.
  - **Quick Capture Popup:** Fast capture mini-window with excerpt editing, collection assignment, status tagging, and recent captures preview.
  - **Keyboard Shortcuts:** Global hotkey <kbd>Alt</kbd>+<kbd>S</kbd> for instant selection capture and <kbd>Alt</kbd>+<kbd>M</kbd> for opening the popup.
  - **Context Menu Integration:** Right-click "Save to Mindora" option on any active webpage selection.
  - **Scroll-to-Quote Navigation:** Generates Chromium Scroll-to-Text Fragment URLs (`#:~:text=...`) to highlight exact quotes upon revisit.
  - **Duplicate Excerpt Detection:** Deterministic 32-bit `djb2` content hashing on `(URL + Excerpt)` to prevent redundant captures.
  - **Full Library Workspace:** Sub-50ms client-side search (<kbd>/</kbd>), collection folders, tag cloud, reading pipeline (`Unread`, `In Progress`, `Reviewed`, `Archived`), and sort controls.
  - **Data Portability:** Clean Markdown (`.md`) export formatted for PKM tools (Obsidian, Notion) and full JSON database backup & merge/replace restore.
  - **Theme System:** Full Dark and Light theme support with seamless cross-view persistence.
