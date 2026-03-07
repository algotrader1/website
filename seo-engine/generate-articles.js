#!/usr/bin/env node

/**
 * ONERA Programmatic SEO Engine
 * Generates dream dictionary articles at scale using Mistral API
 *
 * Usage:
 *   node generate-articles.js                    # Generate all pending articles
 *   node generate-articles.js --tier 2           # Only tier 2
 *   node generate-articles.js --slug spider      # Single article by slug match
 *   node generate-articles.js --category animals # By category
 *   node generate-articles.js --limit 10         # Max 10 articles
 *   node generate-articles.js --dry-run          # Preview without generating
 *   node generate-articles.js --concurrency 3    # Parallel requests (default: 2)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────────────────
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || 'LH6KkRZKdbDMdzvoEdj8JMC8dAewBBEe';
const MISTRAL_MODEL = 'mistral-large-latest';
const OUTPUT_DIR = path.join(__dirname, '..', 'blog', 'posts');
const DB_PATH = path.join(__dirname, 'symbols-database.json');
const LOG_FILE = path.join(__dirname, 'generation-log.json');
const RATE_LIMIT_MS = 2000; // 2s between requests

// ── CLI Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name) => { const i = args.indexOf(`--${name}`); return i !== -1 ? args[i + 1] : null; };
const hasFlag = (name) => args.includes(`--${name}`);

const TIER_FILTER = getArg('tier') ? parseInt(getArg('tier')) : null;
const SLUG_FILTER = getArg('slug');
const CAT_FILTER = getArg('category');
const LIMIT = getArg('limit') ? parseInt(getArg('limit')) : Infinity;
const DRY_RUN = hasFlag('dry-run');
const CONCURRENCY = getArg('concurrency') ? parseInt(getArg('concurrency')) : 2;

// ── Mistral API Call ────────────────────────────────────────────────────────
function callMistral(prompt, systemPrompt) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            model: MISTRAL_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 8000
        });

        const options = {
            hostname: 'api.mistral.ai',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MISTRAL_API_KEY}`,
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.choices && json.choices[0]) {
                        resolve(json.choices[0].message.content);
                    } else {
                        reject(new Error(`Mistral API error: ${data.substring(0, 500)}`));
                    }
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message} — ${data.substring(0, 300)}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(120000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(body);
        req.end();
    });
}

// ── Content Generation Prompt ───────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a dream psychology expert combining Jungian analytical psychology, Bessel van der Kolk's somatic research ("The Body Keeps the Score"), and Peter Levine's Somatic Experiencing framework.

You write dream dictionary articles for Onera — an app that decodes dreams, maps emotions to the body, and guides somatic release exercises.

YOUR UNIQUE ANGLE (no competitor does this):
1. Jungian depth psychology (archetypes, shadow, anima/animus, individuation)
2. Body mapping — where the dream emotion is physically stored
3. Somatic release exercise — a specific body-based exercise for this dream
4. Dream-to-Body Bridge — the connection between the symbol and the nervous system

WRITING STYLE:
- Second person ("you"), intimate, like a wise friend who also studied psychology
- Short paragraphs, punchy sentences, no filler
- Use em dashes (—) not hyphens for punctuation
- Reference specific body sensations (jaw clenching, chest tightness, stomach dropping)
- Never use emojis
- Never say "in conclusion" or "to summarize"
- Bold key phrases with <strong> tags, italics with <em> tags
- Use &mdash; for em dashes in HTML

OUTPUT FORMAT: Return ONLY the article body content as HTML (everything between <article class="article-content"> and </article>). No wrapper, no head, no CSS. Just the inner HTML content starting with the opening paragraph and ending with the disclaimer.

REQUIRED SECTIONS (in order):
1. Opening hook (vivid dream scenario, 2-3 paragraphs)
2. H2: The Symbolic Meaning (Jungian interpretation, what the symbol represents psychologically)
3. H2: The Emotional Connection (what life situations trigger this dream, with a research-box testimonial)
4. H2: Where This Dream Lives in Your Body (3-5 body locations with descriptions)
5. H2: Somatic Release Exercise (specific exercise in a research-box, with scientific rationale)
6. H2: Dream Variations and Their Specific Meanings (HTML table with 7-10 variations)
7. H2: Related Dreams (div with 5 links to other dream articles)
8. HR + CTA div (elegant, distinguished invitation to try Onera — NOT salesy, NOT pushy)
9. HR + H2: FAQ (3-4 questions with H3 + paragraph answers)
10. HR + Disclaimer paragraph

FOR THE CTA: Use this exact HTML structure:
<div class="article-cta">
    <h3>[Elegant, specific heading about this dream]</h3>
    <p>[2 sentences: what Onera does for THIS specific dream. Mention body mapping + somatic release. Distinguished tone.]</p>
    <a href="https://apps.apple.com/app/onera/id6751126653" target="_blank">Try Onera Free &rarr;</a>
</div>

FOR RELATED DREAMS: Use existing slugs from this list:
teeth-falling-out-dream-meaning, snake-dream-meaning, being-chased-dream-meaning, death-dream-meaning, falling-dream-meaning, dream-about-ex-meaning, water-dream-meaning, flying-dream-meaning, spider-dream-meaning, drowning-dream-meaning, fire-dream-meaning, naked-in-public-dream-meaning, house-dream-meaning

Pick the 5 most thematically related.`;

function buildPrompt(symbol) {
    return `Write a dream dictionary article about: "${symbol.symbol}" dreams.

Dream symbol: ${symbol.symbol}
Category: ${symbol.category}
URL slug: ${symbol.slug}
Monthly search volume: ${symbol.volume}

The article should target the keyword "${symbol.symbol.toLowerCase()} dream meaning" and related long-tail variations.

Remember:
- Opening hook must be a vivid, sensory dream scenario specific to ${symbol.symbol}
- Body mapping must identify 3-5 specific body locations where THIS dream's emotion is stored
- Somatic exercise must be unique and specific to the nervous system state THIS dream produces
- Variation table needs 7-10 rows of specific dream scenarios involving ${symbol.symbol}
- FAQ questions should match what people actually search ("what does it mean to dream about ${symbol.symbol.toLowerCase()}", "is dreaming about ${symbol.symbol.toLowerCase()} good or bad", etc.)
- CTA must be elegant and distinguished — like an invitation from a wise mentor, not a sales pitch

Return ONLY the inner HTML content. No markdown. No code fences. Pure HTML starting with <p> and ending with </p>.`;
}

// ── HTML Template ───────────────────────────────────────────────────────────
function buildFullHTML(symbol, articleContent) {
    const title = `${symbol.symbol} Dream Meaning: What Your Subconscious Is Telling You | ONERA`;
    const description = `Dreaming about ${symbol.symbol.toLowerCase()}? Discover the Jungian meaning, where this emotion is stored in your body, and the somatic release exercise that resolves it.`;
    const keywords = `${symbol.symbol.toLowerCase()} dream meaning, dream about ${symbol.symbol.toLowerCase()}, what does ${symbol.symbol.toLowerCase()} mean in a dream, ${symbol.symbol.toLowerCase()} dream interpretation, ${symbol.slug.replace(/-/g, ' ')}`;
    const url = `https://dreaminsight.app/blog/posts/${symbol.slug}.html`;
    const date = new Date().toISOString().split('T')[0];
    const readTime = Math.max(7, Math.ceil(articleContent.length / 1500));

    // Generate FAQ schema from content
    const faqItems = extractFAQ(articleContent);
    const faqSchema = faqItems.length > 0 ? `
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [${faqItems.map(f => `
            {
                "@type": "Question",
                "name": "${escapeJSON(f.question)}",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "${escapeJSON(f.answer)}"
                }
            }`).join(',')}
        ]
    }
    </script>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHTML(title)}</title>
    <meta name="description" content="${escapeHTML(description)}">
    <meta name="keywords" content="${escapeHTML(keywords)}">
    <meta property="og:title" content="${escapeHTML(title)}">
    <meta property="og:description" content="${escapeHTML(description)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${url}">
    <meta property="og:site_name" content="ONERA">
    <meta property="og:locale" content="en_US">
    <meta property="og:published_time" content="${date}T00:00:00Z">
    <meta property="og:author" content="ONERA Research Team">
    <meta property="og:section" content="Dream Dictionary">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHTML(title)}">
    <meta name="twitter:description" content="${escapeHTML(description)}">
    <meta name="twitter:site" content="@onera_dreams">
    <link rel="canonical" href="${url}">
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "${escapeJSON(title)}",
        "author": {"@type": "Organization", "name": "ONERA Research Team"},
        "publisher": {"@type": "Organization", "name": "ONERA"},
        "datePublished": "${date}",
        "description": "${escapeJSON(description)}"
    }
    </script>${faqSchema}
    <style>
        :root {
            --primary-bg: #000000;
            --text-primary: #FFFFFF;
            --text-secondary: #999999;
            --text-muted: #666666;
            --accent: #FFFFFF;
            --border-color: rgba(255, 255, 255, 0.08);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif;
            background: var(--primary-bg); color: var(--text-primary);
            line-height: 1.7; overflow-x: hidden; position: relative;
            min-height: 100vh; font-weight: 300; letter-spacing: -0.01em;
            -webkit-font-smoothing: antialiased;
        }
        .particles-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; opacity: 0.2; }
        .particle { position: absolute; background: rgba(255,255,255,0.08); border-radius: 50%; pointer-events: none; will-change: transform, opacity; }
        .particle-float { animation: float-elegant 25s linear infinite; filter: blur(1px); }
        @keyframes float-elegant { 0% { transform: translateY(100vh) translateX(0); opacity: 0; } 10% { opacity: 0.2; } 90% { opacity: 0.2; } 100% { transform: translateY(-100px) translateX(30px); opacity: 0; } }
        .nav-header { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 1.5rem 3rem; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(to bottom, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 50%, transparent 100%); backdrop-filter: blur(10px); }
        .logo-link { font-size: 1.25rem; font-weight: 200; letter-spacing: 0.2em; color: var(--text-primary); text-decoration: none; text-transform: uppercase; transition: opacity 0.3s; }
        .logo-link:hover { opacity: 0.7; }
        .nav-links { display: flex; gap: 1rem; }
        .nav-link { color: rgba(255,255,255,0.5); text-decoration: none; font-size: 0.875rem; font-weight: 400; letter-spacing: 0.05em; text-transform: uppercase; transition: all 0.4s; padding: 0.75rem 2rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 50px; background: transparent; }
        .nav-link:hover { color: rgba(255,255,255,0.95); border-color: rgba(255,255,255,0.3); transform: translateY(-2px); }
        .article-container { position: relative; z-index: 2; max-width: 800px; margin: 0 auto; padding: 8rem 2rem 6rem; }
        .back-link { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); text-decoration: none; font-size: 0.875rem; font-weight: 400; letter-spacing: 0.05em; text-transform: uppercase; padding: 0.75rem 0; margin-bottom: 3rem; transition: all 0.3s; border-bottom: 1px solid transparent; }
        .back-link:hover { color: var(--text-primary); border-bottom-color: rgba(255,255,255,0.2); }
        .back-arrow { font-size: 1.2rem; transition: transform 0.3s ease; }
        .back-link:hover .back-arrow { transform: translateX(-4px); }
        .article-header { margin-bottom: 4rem; animation: fadeInUp 0.8s cubic-bezier(0.25,0.46,0.45,0.94); }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .article-meta { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; font-size: 0.875rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; }
        .article-title { font-size: clamp(2rem,5vw,3.5rem); font-weight: 100; line-height: 1.2; letter-spacing: 0.02em; margin-bottom: 1.5rem; background: linear-gradient(180deg, #FFFFFF 0%, #CCCCCC 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .article-subtitle { font-size: clamp(1.125rem,2.5vw,1.375rem); font-weight: 300; color: var(--text-secondary); line-height: 1.5; font-style: italic; }
        .article-content { font-size: 1.125rem; line-height: 1.8; animation: fadeIn 1s cubic-bezier(0.25,0.46,0.45,0.94) 0.3s both; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .article-content h2 { font-size: clamp(1.75rem,3vw,2.25rem); font-weight: 300; margin: 3rem 0 1.5rem; color: var(--text-primary); letter-spacing: 0.02em; line-height: 1.3; }
        .article-content h3 { font-size: clamp(1.375rem,2.5vw,1.75rem); font-weight: 400; margin: 2.5rem 0 1rem; color: var(--text-primary); letter-spacing: 0.01em; }
        .article-content p { margin-bottom: 1.75rem; color: rgba(255,255,255,0.9); }
        .article-content p strong { color: var(--text-primary); font-weight: 400; }
        .article-content em { color: var(--text-secondary); font-style: italic; }
        .article-content ul, .article-content ol { margin: 2rem 0; padding-left: 1.5rem; }
        .article-content li { margin-bottom: 0.75rem; color: rgba(255,255,255,0.9); }
        .research-box { background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 2rem; margin: 2.5rem 0; }
        .research-box p { margin-bottom: 0.75rem; }
        .research-box p:last-child { margin-bottom: 0; }
        .article-cta { background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 3rem; margin: 4rem 0; text-align: center; }
        .article-cta h3 { font-size: 1.5rem; font-weight: 300; margin-bottom: 1rem; color: var(--text-primary); }
        .article-cta p { font-size: 1rem; color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.6; }
        .article-cta a { display: inline-block; padding: 0.75rem 2rem; border: 1px solid rgba(255,255,255,0.3); border-radius: 50px; color: var(--text-primary); text-decoration: none; font-size: 0.9rem; letter-spacing: 0.03em; transition: all 0.3s; }
        .article-cta a:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.5); }
        .variation-table { width: 100%; border-collapse: collapse; margin: 2rem 0; }
        .variation-table th, .variation-table td { text-align: left; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 1rem; }
        .variation-table th { color: var(--text-muted); font-weight: 400; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.85rem; }
        .variation-table td { color: rgba(255,255,255,0.85); }
        .related-dreams { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 1.5rem 0; }
        .related-dreams a { padding: 0.5rem 1.25rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 50px; color: var(--text-secondary); text-decoration: none; font-size: 0.875rem; transition: all 0.3s; }
        .related-dreams a:hover { color: var(--text-primary); border-color: rgba(255,255,255,0.3); }
        hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 3rem 0; }
        .footer { background: transparent; padding: 3rem 0 2rem; text-align: center; margin-top: 6rem; border-top: 1px solid rgba(255,255,255,0.05); }
        .footer-links { margin-bottom: 1.5rem; }
        .footer-links a { color: var(--text-muted); text-decoration: none; margin: 0 1.5rem; font-size: 0.875rem; letter-spacing: 0.05em; text-transform: uppercase; transition: color 0.3s; }
        .footer-links a:hover { color: var(--text-primary); }
        .footer-copyright { color: var(--text-muted); font-size: 0.875rem; letter-spacing: 0.02em; }
        @media (max-width: 768px) {
            .nav-header { padding: 1.5rem 1rem; }
            .nav-links { display: none; }
            .article-container { padding: 7rem 1rem 4rem; }
            .article-content { font-size: 1rem; }
            .research-box { padding: 1.5rem; }
            .article-cta { padding: 2rem; }
            .footer-links a { display: block; margin: 0.5rem 0; }
            .variation-table { font-size: 0.9rem; }
            .variation-table th, .variation-table td { padding: 0.75rem 0.5rem; }
        }
    </style>
</head>
<body>
    <div class="particles-container" id="particles"></div>

    <nav class="nav-header">
        <a href="/" class="logo-link">ONERA</a>
        <div class="nav-links">
            <a href="/" class="nav-link">Home</a>
            <a href="/blog" class="nav-link">Blog</a>
            <a href="/founders-letter.html" class="nav-link">Founder's Letter</a>
        </div>
    </nav>

    <div class="article-container">
        <a href="/blog/" class="back-link">
            <span class="back-arrow">&larr;</span>
            Back to Blog
        </a>

        <header class="article-header">
            <div class="article-meta">
                <span>${formatDate(date)}</span>
                <span>&#9201; ${readTime} min read</span>
            </div>
            <h1 class="article-title">${escapeHTML(title.replace(' | ONERA', ''))}</h1>
            <p class="article-subtitle">${symbol.volume > 5000 ? `Over ${(symbol.volume / 1000).toFixed(0)}K people search for this dream every month.` : `Thousands search for this dream every month.`} Here&rsquo;s what it means &mdash; and where it lives in your body.</p>
        </header>

        <article class="article-content">
${articleContent}
        </article>
    </div>

    <footer class="footer">
        <div class="footer-links">
            <a href="/legal.html">Legal</a>
            <a href="/cgu.html">Terms</a>
            <a href="/privacy.html">Privacy</a>
        </div>
        <div class="footer-copyright">&copy; 2026 Onera. All rights reserved.</div>
    </footer>

    <script>
        class ParticleSystem {
            constructor() { this.container = document.getElementById('particles'); this.init(); }
            createParticle() {
                const p = document.createElement('div');
                p.className = 'particle particle-float';
                const s = Math.random() * 3 + 1;
                p.style.width = s + 'px'; p.style.height = s + 'px';
                p.style.left = Math.random() * 100 + '%';
                p.style.animationDelay = Math.random() * 25 + 's';
                p.style.animationDuration = (25 + Math.random() * 10) + 's';
                this.container.appendChild(p);
                setTimeout(() => { if (p.parentNode) p.remove(); }, 35000);
            }
            init() { for (let i = 0; i < 20; i++) setTimeout(() => this.createParticle(), i * 300); setInterval(() => this.createParticle(), 1500); }
        }
        document.addEventListener('DOMContentLoaded', () => new ParticleSystem());
    </script>
</body>
</html>`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function escapeHTML(str) { return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeJSON(str) { return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '').replace(/\t/g, '\\t'); }

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function extractFAQ(html) {
    const faqs = [];
    // Match H3 followed by a paragraph in the FAQ section
    const faqSection = html.split(/FAQ/i).pop() || '';
    const h3Regex = /<h3>(.*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = h3Regex.exec(faqSection)) !== null) {
        faqs.push({
            question: match[1].replace(/<[^>]+>/g, '').trim(),
            answer: match[2].replace(/<[^>]+>/g, '').replace(/&mdash;/g, '—').replace(/&rsquo;/g, "'").replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"').trim()
        });
    }
    return faqs;
}

function cleanContent(content) {
    // Remove markdown code fences if Mistral wraps in ```html
    content = content.replace(/^```html?\s*/i, '').replace(/\s*```\s*$/, '');
    // Remove any leading/trailing whitespace
    content = content.trim();
    // Remove duplicate <article> wrapper if Mistral includes it
    content = content.replace(/<article[^>]*>\s*/gi, '').replace(/<\/article>\s*/gi, '');
    // Add variation-table class to bare <table> tags
    content = content.replace(/<table>/gi, '<table class="variation-table">');
    // Fix related dream links to use proper paths
    content = content.replace(/href="([a-z-]+dream-meaning[^"]*)"(?!.*\.html)/gi, 'href="/blog/posts/$1.html"');
    content = content.replace(/href="([a-z-]+meaning)"(?!.*\.html)/gi, 'href="/blog/posts/$1.html"');
    // Ensure content starts with <p> or <h2>
    if (!content.startsWith('<')) {
        content = '<p>' + content;
    }
    return content;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Load log ────────────────────────────────────────────────────────────────
function loadLog() {
    try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8')); }
    catch { return { generated: [], errors: [], stats: { total: 0, success: 0, failed: 0 } }; }
}

function saveLog(log) {
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  ONERA Programmatic SEO Engine               ║');
    console.log('║  Dream Dictionary Generator — Mistral API    ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // Load database
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const log = loadLog();

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Filter symbols
    let symbols = db.symbols.filter(s => !s.done); // Skip already done

    // Also skip already generated (check file existence)
    symbols = symbols.filter(s => {
        const filePath = path.join(OUTPUT_DIR, `${s.slug}.html`);
        if (fs.existsSync(filePath)) {
            console.log(`  ⊘ ${s.slug} — already exists, skipping`);
            return false;
        }
        return true;
    });

    if (TIER_FILTER) symbols = symbols.filter(s => s.tier === TIER_FILTER);
    if (SLUG_FILTER) symbols = symbols.filter(s => s.slug.includes(SLUG_FILTER));
    if (CAT_FILTER) symbols = symbols.filter(s => s.category === CAT_FILTER);
    symbols = symbols.slice(0, LIMIT);

    // Sort by volume (highest first)
    symbols.sort((a, b) => b.volume - a.volume);

    console.log(`📊 Database: ${db.symbols.length} total symbols`);
    console.log(`📝 To generate: ${symbols.length} articles`);
    console.log(`⚡ Concurrency: ${CONCURRENCY}`);
    console.log(`🤖 Model: ${MISTRAL_MODEL}`);
    if (DRY_RUN) console.log('🏃 DRY RUN — no files will be created\n');
    console.log('');

    if (symbols.length === 0) {
        console.log('Nothing to generate. All articles exist or filters returned empty.');
        return;
    }

    if (DRY_RUN) {
        symbols.forEach(s => console.log(`  Would generate: ${s.slug} (${s.category}, tier ${s.tier}, ${s.volume}/mo)`));
        console.log(`\nTotal: ${symbols.length} articles`);
        return;
    }

    // Process in batches
    let completed = 0;
    let failed = 0;
    const startTime = Date.now();

    for (let i = 0; i < symbols.length; i += CONCURRENCY) {
        const batch = symbols.slice(i, i + CONCURRENCY);
        const promises = batch.map(async (symbol) => {
            const ts = new Date().toLocaleTimeString();
            console.log(`[${ts}] Generating: ${symbol.slug} (${symbol.category}, ${symbol.volume}/mo)...`);

            try {
                const prompt = buildPrompt(symbol);
                const rawContent = await callMistral(prompt, SYSTEM_PROMPT);
                const content = cleanContent(rawContent);
                const html = buildFullHTML(symbol, content);

                const filePath = path.join(OUTPUT_DIR, `${symbol.slug}.html`);
                fs.writeFileSync(filePath, html);

                completed++;
                log.generated.push({ slug: symbol.slug, date: new Date().toISOString(), chars: html.length });
                console.log(`  ✓ ${symbol.slug} — ${(html.length / 1024).toFixed(1)}KB (${completed}/${symbols.length})`);
            } catch (err) {
                failed++;
                log.errors.push({ slug: symbol.slug, date: new Date().toISOString(), error: err.message });
                console.error(`  ✗ ${symbol.slug} — ${err.message}`);
            }
        });

        await Promise.all(promises);

        // Rate limit between batches
        if (i + CONCURRENCY < symbols.length) {
            await sleep(RATE_LIMIT_MS);
        }
    }

    // Update log
    log.stats.total += completed + failed;
    log.stats.success += completed;
    log.stats.failed += failed;
    saveLog(log);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n══════════════════════════════════════════════');
    console.log(`Done in ${elapsed}s`);
    console.log(`  ✓ Generated: ${completed}`);
    console.log(`  ✗ Failed: ${failed}`);
    console.log(`  📁 Output: ${OUTPUT_DIR}`);
    console.log(`  📋 Log: ${LOG_FILE}`);
    console.log('══════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
