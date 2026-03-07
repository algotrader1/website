const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, 'blog', 'posts');

const newCSS = `
:root {
    --bg: #f8f6f3;
    --bg-warm: #f3f0ec;
    --bg-card: #ffffff;
    --fg: #1a1917;
    --fg-2: #5c5a56;
    --fg-3: #8a8780;
    --fg-muted: #b5b3ae;
    --accent: #c4956a;
    --accent-soft: #d4a87a;
    --accent-bg: rgba(196, 149, 106, 0.08);
    --line: rgba(0,0,0,0.06);
    --line-strong: rgba(0,0,0,0.1);
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 20px rgba(0,0,0,0.06);
    --radius: 16px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: 'Inter', -apple-system, system-ui, sans-serif;
    background: var(--bg); color: var(--fg);
    line-height: 1.7; overflow-x: hidden;
    min-height: 100vh; font-weight: 300;
    -webkit-font-smoothing: antialiased;
}
::selection { background: var(--accent); color: white; }
nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    padding: 1.25rem 2rem;
    display: flex; justify-content: space-between; align-items: center;
    background: rgba(248, 246, 243, 0.85);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--line);
}
.nav-logo {
    font-size: 1.125rem; font-weight: 600; letter-spacing: 0.08em;
    color: var(--fg); text-decoration: none; text-transform: uppercase;
}
.nav-links { display: flex; gap: 1.5rem; align-items: center; }
.nav-links a {
    color: var(--fg-2); text-decoration: none; font-size: 0.875rem;
    font-weight: 400; transition: color 0.3s;
}
.nav-links a:hover { color: var(--fg); }
.nav-cta {
    background: var(--fg) !important; color: var(--bg) !important;
    padding: 0.5rem 1.25rem !important; border-radius: 50px;
    font-weight: 500 !important; transition: opacity 0.3s !important;
}
.nav-cta:hover { opacity: 0.85; }
.article-container { max-width: 760px; margin: 0 auto; padding: 7rem 2rem 4rem; }
.back-link {
    display: inline-flex; align-items: center; gap: 0.5rem;
    color: var(--fg-3); text-decoration: none; font-size: 0.875rem;
    font-weight: 400; letter-spacing: 0.02em;
    padding: 0.5rem 0; margin-bottom: 2.5rem; transition: color 0.3s;
}
.back-link:hover { color: var(--fg); }
.back-arrow { font-size: 1.1rem; transition: transform 0.3s; }
.back-link:hover .back-arrow { transform: translateX(-4px); }
.article-header { margin-bottom: 3rem; }
.article-meta {
    display: flex; align-items: center; gap: 1rem;
    margin-bottom: 1.5rem; font-size: 0.8rem; color: var(--fg-muted);
    text-transform: uppercase; letter-spacing: 0.08em;
}
.article-title {
    font-size: clamp(2rem, 5vw, 3rem); font-weight: 600;
    line-height: 1.2; letter-spacing: -0.02em; margin-bottom: 1rem;
    color: var(--fg);
}
.article-subtitle {
    font-size: clamp(1.05rem, 2vw, 1.2rem); font-weight: 300;
    color: var(--fg-2); line-height: 1.6;
}
.article-content { font-size: 1.05rem; line-height: 1.8; }
.article-content h2 {
    font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 600;
    margin: 2.5rem 0 1rem; color: var(--fg);
    letter-spacing: -0.01em; line-height: 1.3;
}
.article-content h3 {
    font-size: clamp(1.2rem, 2.5vw, 1.5rem); font-weight: 500;
    margin: 2rem 0 0.75rem; color: var(--fg);
}
.article-content p { margin-bottom: 1.5rem; color: var(--fg-2); }
.article-content p strong { color: var(--fg); font-weight: 500; }
.article-content em { color: var(--fg-3); font-style: italic; }
.article-content ul, .article-content ol { margin: 1.5rem 0; padding-left: 1.5rem; }
.article-content li { margin-bottom: 0.6rem; color: var(--fg-2); }
.research-box {
    background: var(--bg-warm); border: 1px solid var(--line);
    border-radius: var(--radius); padding: 1.75rem; margin: 2rem 0;
}
.research-box p { margin-bottom: 0.75rem; color: var(--fg-2); }
.research-box p:last-child { margin-bottom: 0; }
.article-cta {
    background: var(--fg); border-radius: var(--radius);
    padding: 2.5rem; margin: 3rem 0; text-align: center;
}
.article-cta h3 { font-size: 1.35rem; font-weight: 500; margin-bottom: 0.75rem; color: var(--bg); }
.article-cta p { font-size: 0.95rem; color: rgba(248,246,243,0.7); margin-bottom: 1.25rem; line-height: 1.6; }
.article-cta a {
    display: inline-flex; align-items: center; gap: 0.5rem;
    padding: 0.75rem 2rem; background: var(--bg); color: var(--fg);
    border-radius: 50px; text-decoration: none; font-size: 0.9rem;
    font-weight: 500; transition: all 0.3s;
}
.article-cta a:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.variation-table { width: 100%; border-collapse: collapse; margin: 2rem 0; }
.variation-table th, .variation-table td {
    text-align: left; padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--line); font-size: 0.95rem;
}
.variation-table th {
    color: var(--fg-muted); font-weight: 500; text-transform: uppercase;
    letter-spacing: 0.05em; font-size: 0.8rem; background: var(--bg-warm);
}
.variation-table td { color: var(--fg-2); }
.related-dreams { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 1.5rem 0; }
.related-dreams a {
    padding: 0.4rem 1rem; border: 1px solid var(--line-strong);
    border-radius: 50px; color: var(--fg-2); text-decoration: none;
    font-size: 0.85rem; transition: all 0.3s;
}
.related-dreams a:hover { color: var(--fg); border-color: var(--accent); background: var(--accent-bg); }
hr { border: none; border-top: 1px solid var(--line); margin: 2.5rem 0; }
footer {
    padding: 3rem 0 2rem; text-align: center;
    border-top: 1px solid var(--line); margin-top: 4rem;
}
.footer-links { margin-bottom: 1.5rem; }
.footer-links a {
    color: var(--fg-3); text-decoration: none; margin: 0 1.25rem;
    font-size: 0.85rem; transition: color 0.3s;
}
.footer-links a:hover { color: var(--fg); }
.footer-copyright { font-size: 0.8rem; color: var(--fg-muted); }
@media (max-width: 768px) {
    nav { padding: 1rem 1.25rem; }
    .nav-links a:not(.nav-cta) { display: none; }
    .article-container { padding: 5.5rem 1.25rem 3rem; }
    .article-content { font-size: 1rem; }
    .research-box { padding: 1.25rem; }
    .article-cta { padding: 2rem; }
    .footer-links a { margin: 0 0.75rem; }
}
`;

const newNav = `<nav>
    <a href="/" class="nav-logo">Onera</a>
    <div class="nav-links">
        <a href="/blog">Blog</a>
        <a href="/founders-letter.html">Letter</a>
        <a href="https://apps.apple.com/app/onera/id6751126653" target="_blank" class="nav-cta">Download</a>
    </div>
</nav>`;

const newFooter = `<footer>
    <div class="footer-links">
        <a href="/legal.html">Legal</a>
        <a href="/cgu.html">Terms</a>
        <a href="/privacy.html">Privacy</a>
        <a href="/blog">Blog</a>
        <a href="/founders-letter.html">Founder's Letter</a>
    </div>
    <div class="footer-copyright">&copy; 2026 Onera. All rights reserved.</div>
</footer>`;

const fontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">`;

const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.html'));
let updated = 0;
let errors = [];

for (const file of files) {
    const filePath = path.join(postsDir, file);
    try {
        let html = fs.readFileSync(filePath, 'utf8');
        const original = html;

        // 1. Replace the <style>...</style> block with new CSS
        html = html.replace(/<style>[\s\S]*?<\/style>/, `<style>${newCSS}</style>`);

        // 2. Replace the nav - handle both <nav class="nav-header"> and <nav ...>
        html = html.replace(/<nav[\s\S]*?<\/nav>/, newNav);

        // 3. Remove particles container
        html = html.replace(/\s*<div class="particles-container" id="particles"><\/div>\s*/g, '\n');

        // 4. Remove the ParticleSystem script block
        html = html.replace(/\s*<script>\s*class ParticleSystem[\s\S]*?<\/script>\s*/g, '\n');

        // 5. Replace the footer - handle both <footer class="footer"> and <footer ...>
        html = html.replace(/<footer[\s\S]*?<\/footer>/, newFooter);

        // 6. Add Inter font links before <style> if not already present
        if (!html.includes('fonts.googleapis.com/css2?family=Inter')) {
            html = html.replace(/<style>/, fontLinks + '\n    <style>');
        }

        // 7. Remove position: relative; z-index: 2; from article-container inline styles
        // Handle in the CSS (already replaced), but also check for inline styles on the div
        html = html.replace(
            /(<div class="article-container")\s+style="[^"]*position:\s*relative;\s*z-index:\s*2;?[^"]*"/g,
            '$1'
        );

        // 8. Clean inline gradient styles on article-title elements
        html = html.replace(
            /(<[^>]*class="article-title"[^>]*)\s+style="[^"]*(?:background:\s*linear-gradient|webkit-background-clip|webkit-text-fill-color|background-clip)[^"]*"/g,
            '$1'
        );

        if (html !== original) {
            fs.writeFileSync(filePath, html, 'utf8');
            updated++;
        } else {
            console.log(`  [SKIP] ${file} - no changes detected`);
        }
    } catch (err) {
        errors.push({ file, error: err.message });
        console.error(`  [ERROR] ${file}: ${err.message}`);
    }
}

console.log(`\nDone! Updated ${updated} of ${files.length} files.`);
if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
}
