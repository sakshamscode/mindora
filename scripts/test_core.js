/**
 * Automated test suite for Mindora Core Logic
 */

import { computeContentHash, buildTextFragmentUrl, extractDomain, formatRelativeDate } from '../lib/utils.js';
import { generateMarkdown } from '../lib/export.js';

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

console.log('\n--- Testing lib/export.js (Markdown) ---');

const mockItems = [
  {
    id: '1',
    pageTitle: 'Deep Learning Review',
    sourceUrl: 'https://arxiv.org/abs/1234',
    selectedText: 'Neural networks are universal approximators.\nThey learn hierarchical representations.',
    userNote: 'Key takeaway for Chapter 2',
    collectionId: 'col_1',
    tags: ['ai', 'research'],
    status: 'in_progress',
    createdAt: Date.now()
  }
];

const mockCollections = {
  col_1: { id: 'col_1', name: 'AI Research', color: '#6366F1' }
};

const md = generateMarkdown(mockItems, mockCollections);
assert(md.includes('# Mindora Knowledge Export'), 'Includes header');
assert(md.includes('> Neural networks are universal approximators.'), 'Proper blockquote for excerpt');
assert(md.includes('**Takeaway:** Key takeaway for Chapter 2'), 'Includes user takeaway');
assert(md.includes('*Collection:* **AI Research**'), 'Includes collection name');
assert(md.includes('`#ai` `#research`'), 'Includes tag list');

console.log(`\n================================`);
console.log(`Total tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
