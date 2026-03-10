#!/usr/bin/env node
/**
 * inject-email-capture.js
 *
 * Injects <script src="/email-capture.js"></script> before </body>
 * in all blog posts, index.html, and blog/index.html.
 *
 * Usage: node inject-email-capture.js
 */

const fs = require('fs');
const path = require('path');

const WEBSITE_DIR = path.join(__dirname);
const POSTS_DIR = path.join(WEBSITE_DIR, 'blog', 'posts');
const SCRIPT_TAG = '<script src="/email-capture.js"></script>';

let updated = 0;
let skipped = 0;
let errors = 0;

function injectIntoFile(filePath) {
  try {
    let html = fs.readFileSync(filePath, 'utf8');

    // Skip if already injected
    if (html.includes('email-capture.js')) {
      skipped++;
      return;
    }

    // Find </body> and insert script before it
    const bodyCloseIndex = html.lastIndexOf('</body>');
    if (bodyCloseIndex === -1) {
      console.log('  SKIP (no </body>): ' + path.relative(WEBSITE_DIR, filePath));
      skipped++;
      return;
    }

    html = html.slice(0, bodyCloseIndex) + '    ' + SCRIPT_TAG + '\n' + html.slice(bodyCloseIndex);
    fs.writeFileSync(filePath, html, 'utf8');
    updated++;
  } catch (err) {
    console.error('  ERROR: ' + path.relative(WEBSITE_DIR, filePath) + ' — ' + err.message);
    errors++;
  }
}

console.log('Email Capture Injection Script');
console.log('==============================\n');

// 1. Process blog/posts/*.html
if (fs.existsSync(POSTS_DIR)) {
  const posts = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.html'));
  console.log('Found ' + posts.length + ' blog posts in blog/posts/');
  posts.forEach(function(file) {
    injectIntoFile(path.join(POSTS_DIR, file));
  });
} else {
  console.log('WARNING: blog/posts/ directory not found');
}

// 2. Process index.html (landing page)
const indexFile = path.join(WEBSITE_DIR, 'index.html');
if (fs.existsSync(indexFile)) {
  console.log('Processing index.html');
  injectIntoFile(indexFile);
} else {
  console.log('WARNING: index.html not found');
}

// 3. Process blog/index.html
const blogIndexFile = path.join(WEBSITE_DIR, 'blog', 'index.html');
if (fs.existsSync(blogIndexFile)) {
  console.log('Processing blog/index.html');
  injectIntoFile(blogIndexFile);
} else {
  console.log('WARNING: blog/index.html not found');
}

// Summary
console.log('\n--- Results ---');
console.log('Updated: ' + updated + ' files');
console.log('Skipped: ' + skipped + ' files (already injected or no </body>)');
if (errors > 0) console.log('Errors:  ' + errors + ' files');
console.log('Done.');
