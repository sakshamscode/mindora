/**
 * Automated test suite for Mindora Core Logic, Translation, i18n, and Security Sanitization
 */

import {
  computeContentHash,
  buildTextFragmentUrl,
  extractDomain,
  formatRelativeDate,
  escapeHtml,
  sanitizeUrl,
  sanitizeColor,
  sanitizeId,
  sanitizeFaviconUrl,
  safeHighlightHtml
} from '../lib/utils.js';
import { generateMarkdown } from '../lib/export.js';
import { t, SUPPORTED_LANGUAGES } from '../lib/i18n.js';
import { getLanguageName } from '../lib/translator.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

console.log('--- Testing lib/utils.js ---');

// 1. Content Hash & Duplicate Detection
const url1 = 'https://developer.mozilla.org/en-US/docs/Web/API/Selection#examples';
const url2 = 'https://developer.mozilla.org/en-US/docs/Web/API/Selection';
const text1 = 'The Selection interface represents the range of text selected by the user';
const text2 = '  the selection interface represents the range of text selected by the user \n';

const hash1 = computeContentHash(url1, text1);
const hash2 = computeContentHash(url2, text2);
assert(hash1 === hash2, 'Hash matches across trailing hashes and whitespace variations');

const hash3 = computeContentHash(url1, 'Different excerpt');
assert(hash1 !== hash3, 'Hash differs for distinct text excerpts');

// 2. Text Fragment URL Generation
const fragmentUrl = buildTextFragmentUrl('https://example.com/article', 'first second third fourth fifth sixth seventh eighth ninth tenth');
assert(fragmentUrl.includes('#:~:text='), 'Generates Scroll-to-Text Fragment anchor');
assert(fragmentUrl.includes('first%20second%20third%20fourth'), 'Uses multi-word start fragment for long passages');

const shortFragment = buildTextFragmentUrl('https://example.com/page', 'Short phrase');
assert(shortFragment === 'https://example.com/page#:~:text=Short%20phrase', 'Handles short phrases directly');

// 3. Domain extraction
assert(extractDomain('https://www.nature.com/articles/123') === 'nature.com', 'Strips www. from domain');
assert(extractDomain('http://sub.domain.org/path') === 'sub.domain.org', 'Extracts subdomain accurately');

// 4. Relative Date
const now = Date.now();
assert(formatRelativeDate(now - 10000) === 'Just now', 'Formats recent timestamp as Just now');
assert(formatRelativeDate(now - 120000) === '2m ago', 'Formats 2 minutes ago');
assert(formatRelativeDate(now - 3600000 * 3) === '3h ago', 'Formats 3 hours ago');

console.log('\n--- Testing Security Sanitizers (XSS & Injection Defense) ---');

// 5. HTML Escaping
assert(escapeHtml('<script>alert("xss")</script>') === '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', 'Escapes script tags and quotes');
assert(escapeHtml(`Tom & 'Jerry'`) === 'Tom &amp; &#39;Jerry&#39;', 'Escapes ampersands and single quotes');
assert(escapeHtml(null) === '' && escapeHtml(undefined) === '', 'Safely handles null and undefined');

// 6. URL Sanitization (javascript: pseudo-protocol blocking)
assert(sanitizeUrl('javascript:alert(document.cookie)') === '#', 'Blocks javascript: URI execution');
assert(sanitizeUrl('data:text/html,<script>alert(1)</script>') === '#', 'Blocks data: URI execution');
assert(sanitizeUrl('vbscript:msgbox("xss")') === '#', 'Blocks vbscript: URI execution');
assert(sanitizeUrl('https://example.com/article?id=1') === 'https://example.com/article?id=1', 'Permits valid HTTPS URL');
assert(sanitizeUrl('http://localhost:3000') === 'http://localhost:3000', 'Permits valid HTTP URL');
assert(sanitizeUrl('#top') === '#top', 'Permits safe fragment link');

// 7. Color Sanitization (CSS Style injection prevention)
assert(sanitizeColor('#6366F1') === '#6366F1', 'Allows valid 6-character hex color');
assert(sanitizeColor('#FFF') === '#FFF', 'Allows valid 3-character hex color');
assert(sanitizeColor('red; background: url("https://attacker.com")') === '#6366F1', 'Blocks CSS style breakout');
assert(sanitizeColor('" onmouseover="alert(1)') === '#6366F1', 'Blocks attribute quote breakout in colors');

// 8. ID Sanitization
assert(sanitizeId('item_123-abc') === 'item_123-abc', 'Allows safe alphanumeric and hyphenated IDs');
assert(sanitizeId('123" onclick="alert(1)') === '123onclickalert1', 'Strips quotes and injection characters from IDs');

// 9. Favicon URL Sanitization
assert(sanitizeFaviconUrl('https://example.com/favicon.png') === 'https://example.com/favicon.png', 'Permits valid HTTPS favicon');
assert(sanitizeFaviconUrl('data:image/svg+xml,<svg onload=alert(1)>') === '', 'Blocks dangerous data: SVG favicons');

// 10. Safe Search Highlighting (Entity collision and HTML safety)
const rawSample = 'Tom & Jerry love <b>coding</b>';
const highlighted = safeHighlightHtml(rawSample, 'Tom &');
assert(highlighted.includes('<mark class="search-highlight">Tom</mark>'), 'Highlights matching token');
assert(highlighted.includes('&amp;'), 'Preserves ampersand entity encoding');
assert(!highlighted.includes('<b>'), 'Escapes unescaped HTML tags in input text');
assert(highlighted.includes('&lt;b&gt;coding&lt;/b&gt;'), 'Raw HTML tags properly escaped in output');

console.log('\n--- Testing lib/i18n.js (Localization) ---');
assert(SUPPORTED_LANGUAGES.length >= 10, 'Supports at least 10 world languages');
assert(t('save_to_mindora', 'en') === 'Save to Mindora', 'Translates English string');
assert(t('save_to_mindora', 'hi') === 'मिन्दोरा में सहेजें', 'Translates Hindi string');
assert(t('save_to_mindora', 'es') === 'Guardar en Mindora', 'Translates Spanish string');
assert(t('save_to_mindora', 'ja') === 'Mindoraに保存', 'Translates Japanese string');

const paramTest = t('confirm_delete_col', 'en', { name: 'Thesis' });
assert(paramTest.includes('Thesis'), 'Interpolates named parameters correctly');

console.log('\n--- Testing lib/translator.js ---');
assert(getLanguageName('ja').includes('日本語'), 'Resolves native name for Japanese');
assert(getLanguageName('hi').includes('हिन्दी'), 'Resolves native name for Hindi');
assert(getLanguageName('es').includes('Español'), 'Resolves native name for Spanish');

console.log('\n--- Testing lib/export.js (Markdown with Dual Language) ---');

const mockItems = [
  {
    id: '1',
    pageTitle: 'Japanese AI Research',
    sourceUrl: 'https://example.jp/article',
    selectedText: '人工知能は人間の知的能力を模倣するコンピュータシステムです。',
    isTranslated: true,
    translatedText: 'Artificial intelligence is a computer system that mimics human intellectual abilities.',
    sourceLanguage: 'ja',
    targetLanguage: 'en',
    userNote: 'Key definition for introduction',
    collectionId: 'col_1',
    tags: ['ai', 'japan'],
    status: 'in_progress',
    createdAt: Date.now()
  }
];

const mockCollections = {
  col_1: { id: 'col_1', name: 'AI Research', color: '#6366F1' }
};

const md = generateMarkdown(mockItems, mockCollections);
assert(md.includes('# Mindora Knowledge Export'), 'Includes header');
assert(md.includes('> 人工知能は人間の知的能力を模倣するコンピュータシステムです。'), 'Includes original excerpt blockquote');
assert(md.includes('**Translation (EN):**'), 'Includes translation header tag');
assert(md.includes('> Artificial intelligence is a computer system'), 'Includes translated blockquote');
assert(md.includes('**Takeaway:** Key definition for introduction'), 'Includes user takeaway');

console.log(`\n================================`);
console.log(`Total tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
