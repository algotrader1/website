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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #f8f6f3; --bg-warm: #f3f0ec; --bg-card: #ffffff;
            --fg: #1a1917; --fg-2: #5c5a56; --fg-3: #8a8780; --fg-muted: #b5b3ae;
            --accent: #c4956a; --accent-soft: #d4a87a; --accent-bg: rgba(196,149,106,0.08);
            --line: rgba(0,0,0,0.06); --line-strong: rgba(0,0,0,0.1);
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.04); --shadow-md: 0 4px 20px rgba(0,0,0,0.06);
            --radius: 16px;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--fg); line-height: 1.7; overflow-x: hidden; min-height: 100vh; font-weight: 300; -webkit-font-smoothing: antialiased; }
        ::selection { background: var(--accent); color: white; }
        nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 1.25rem 2rem; display: flex; justify-content: space-between; align-items: center; background: rgba(248,246,243,0.85); backdrop-filter: blur(20px); border-bottom: 1px solid var(--line); }
        .nav-logo { font-size: 1.125rem; font-weight: 600; letter-spacing: 0.08em; color: var(--fg); text-decoration: none; text-transform: uppercase; }
        .nav-links { display: flex; gap: 1.5rem; align-items: center; }
        .nav-links a { color: var(--fg-2); text-decoration: none; font-size: 0.875rem; font-weight: 400; transition: color 0.3s; }
        .nav-links a:hover { color: var(--fg); }
        .nav-cta { background: var(--fg) !important; color: var(--bg) !important; padding: 0.5rem 1.25rem !important; border-radius: 50px; font-weight: 500 !important; transition: opacity 0.3s !important; }
        .nav-cta:hover { opacity: 0.85; }
        .article-container { max-width: 760px; margin: 0 auto; padding: 7rem 2rem 4rem; }
        .back-link { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--fg-3); text-decoration: none; font-size: 0.875rem; font-weight: 400; letter-spacing: 0.02em; padding: 0.5rem 0; margin-bottom: 2.5rem; transition: color 0.3s; }
        .back-link:hover { color: var(--fg); }
        .back-arrow { font-size: 1.1rem; transition: transform 0.3s; }
        .back-link:hover .back-arrow { transform: translateX(-4px); }
        .article-header { margin-bottom: 3rem; }
        .article-meta { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; font-size: 0.8rem; color: var(--fg-muted); text-transform: uppercase; letter-spacing: 0.08em; }
        .article-title { font-size: clamp(2rem,5vw,3rem); font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; margin-bottom: 1rem; color: var(--fg); }
        .article-subtitle { font-size: clamp(1.05rem,2vw,1.2rem); font-weight: 300; color: var(--fg-2); line-height: 1.6; }
        .article-content { font-size: 1.05rem; line-height: 1.8; }
        .article-content h2 { font-size: clamp(1.5rem,3vw,2rem); font-weight: 600; margin: 2.5rem 0 1rem; color: var(--fg); letter-spacing: -0.01em; line-height: 1.3; }
        .article-content h3 { font-size: clamp(1.2rem,2.5vw,1.5rem); font-weight: 500; margin: 2rem 0 0.75rem; color: var(--fg); }
        .article-content p { margin-bottom: 1.5rem; color: var(--fg-2); }
        .article-content p strong { color: var(--fg); font-weight: 500; }
        .article-content em { color: var(--fg-3); font-style: italic; }
        .article-content ul, .article-content ol { margin: 1.5rem 0; padding-left: 1.5rem; }
        .article-content li { margin-bottom: 0.6rem; color: var(--fg-2); }
        .research-box { background: var(--bg-warm); border: 1px solid var(--line); border-radius: var(--radius); padding: 1.75rem; margin: 2rem 0; }
        .research-box p { margin-bottom: 0.75rem; color: var(--fg-2); }
        .research-box p:last-child { margin-bottom: 0; }
        .article-cta { background: var(--fg); border-radius: var(--radius); padding: 2.5rem; margin: 3rem 0; text-align: center; }
        .article-cta h3 { font-size: 1.35rem; font-weight: 500; margin-bottom: 0.75rem; color: var(--bg); }
        .article-cta p { font-size: 0.95rem; color: rgba(248,246,243,0.7); margin-bottom: 1.25rem; line-height: 1.6; }
        .article-cta a { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 2rem; background: var(--bg); color: var(--fg); border-radius: 50px; text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: all 0.3s; }
        .article-cta a:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .variation-table { width: 100%; border-collapse: collapse; margin: 2rem 0; }
        .variation-table th, .variation-table td { text-align: left; padding: 0.875rem 1rem; border-bottom: 1px solid var(--line); font-size: 0.95rem; }
        .variation-table th { color: var(--fg-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.8rem; background: var(--bg-warm); }
        .variation-table td { color: var(--fg-2); }
        .related-dreams { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 1.5rem 0; }
        .related-dreams a { padding: 0.4rem 1rem; border: 1px solid var(--line-strong); border-radius: 50px; color: var(--fg-2); text-decoration: none; font-size: 0.85rem; transition: all 0.3s; }
        .related-dreams a:hover { color: var(--fg); border-color: var(--accent); background: var(--accent-bg); }
        hr { border: none; border-top: 1px solid var(--line); margin: 2.5rem 0; }
        footer { padding: 3rem 0 2rem; text-align: center; border-top: 1px solid var(--line); margin-top: 4rem; }
        .footer-links { margin-bottom: 1.5rem; }
        .footer-links a { color: var(--fg-3); text-decoration: none; margin: 0 1.25rem; font-size: 0.85rem; transition: color 0.3s; }
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
    </style>
</head>
<body>
    <nav>
        <a href="/" class="nav-logo">Onera</a>
        <div class="nav-links">
            <a href="/blog">Blog</a>
            <a href="/founders-letter.html">Letter</a>
            <a href="https://apps.apple.com/app/onera/id6751126653" target="_blank" class="nav-cta">Download</a>
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

    <footer>
        <div class="footer-links">
            <a href="/legal.html">Legal</a>
            <a href="/cgu.html">Terms</a>
            <a href="/privacy.html">Privacy</a>
            <a href="/blog">Blog</a>
            <a href="/founders-letter.html">Founder's Letter</a>
        </div>
        <div class="footer-copyright">&copy; 2026 Onera. All rights reserved.</div>
    </footer>
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
