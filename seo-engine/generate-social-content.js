#!/usr/bin/env node

/**
 * ONERA Social Content Generator
 * Transforms dream articles into multi-platform social media content
 *
 * Usage:
 *   node generate-social-content.js                      # Generate for all articles
 *   node generate-social-content.js --slug snake          # Single symbol
 *   node generate-social-content.js --tier 1              # Only tier 1
 *   node generate-social-content.js --format tiktok       # Only TikTok scripts
 *   node generate-social-content.js --format carousel     # Only Instagram carousels
 *   node generate-social-content.js --format thread       # Only Twitter threads
 *   node generate-social-content.js --limit 5             # Max 5 symbols
 *   node generate-social-content.js --dry-run             # Preview only
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────────────────
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || 'LH6KkRZKdbDMdzvoEdj8JMC8dAewBBEe';
const MISTRAL_MODEL = 'mistral-large-latest';
const DB_PATH = path.join(__dirname, 'symbols-database.json');
const OUTPUT_DIR = path.join('/Users/user/Documents/DreamInsights Ads', 'social-content');
const ARTICLES_DIR = path.join(__dirname, '..', 'blog', 'posts');

// ── CLI Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : null; };
const hasArg = (name) => args.includes(`--${name}`);

const FILTER_SLUG = getArg('slug');
const FILTER_TIER = getArg('tier') ? parseInt(getArg('tier')) : null;
const FILTER_FORMAT = getArg('format'); // tiktok, carousel, thread, all
const LIMIT = getArg('limit') ? parseInt(getArg('limit')) : null;
const DRY_RUN = hasArg('dry-run');

// ── Ensure output dirs ──────────────────────────────────────────────────────
['tiktok-scripts', 'instagram-carousels', 'twitter-threads', 'pinterest-pins'].forEach(dir => {
    const p = path.join(OUTPUT_DIR, dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ── Mistral API ─────────────────────────────────────────────────────────────
function callMistral(systemPrompt, userPrompt) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            model: MISTRAL_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 4000,
            temperature: 0.7
        });

        const req = https.request({
            hostname: 'api.mistral.ai',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MISTRAL_API_KEY}`,
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices?.[0]?.message?.content) resolve(parsed.choices[0].message.content);
                    else reject(new Error(parsed.message || 'No content'));
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(body);
        req.end();
    });
}

// ── Extract article summary from HTML ───────────────────────────────────────
function extractArticleSummary(slug) {
    const filePath = path.join(ARTICLES_DIR, `${slug}.html`);
    if (!fs.existsSync(filePath)) return null;

    const html = fs.readFileSync(filePath, 'utf-8');

    // Extract title
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : slug;

    // Extract body text (strip HTML)
    const contentMatch = html.match(/<div class="article-content">([\s\S]*?)<\/div>\s*<\/article>/);
    let bodyText = '';
    if (contentMatch) {
        bodyText = contentMatch[1]
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 3000); // Keep first 3000 chars for context
    }

    return { title, bodyText, slug };
}

// ── Prompts ─────────────────────────────────────────────────────────────────

const TIKTOK_SYSTEM = `You are a viral TikTok/Reels script writer for Onera, a dream analysis app that maps dreams to body locations and provides somatic release exercises.

Write a 60-second TikTok/Reels script. Rules:
- Hook in first 2 seconds (question or shocking statement)
- Conversational, direct-to-camera tone
- Include the body mapping angle (where the dream emotion is stored)
- End with a soft CTA: "Link in bio" or "Comment your recurring dream"
- Format: [HOOK] [BODY] [REVEAL] [CTA]
- Include visual/text overlay notes in brackets
- Keep it under 150 words spoken
- NO hashtags in the script itself
- Write 5 suggested hashtags separately at the end

Output format:
HOOK: (first 2 seconds)
---
SCRIPT: (full spoken script)
---
TEXT OVERLAYS: (what appears on screen)
---
HASHTAGS: #dream #meaning etc`;

const CAROUSEL_SYSTEM = `You are an Instagram carousel designer for Onera, a dream analysis app. Create a 6-slide carousel.

Rules:
- Slide 1: Hook question with bold text (stop the scroll)
- Slide 2: The Jungian/psychological meaning (1-2 sentences)
- Slide 3: "Where it lives in your body" — specific body location + why
- Slide 4: The 60-second somatic release exercise (step by step)
- Slide 5: "Save this. Share with someone who has this dream."
- Slide 6: CTA — "Decode your dreams in Onera" + "Link in bio"
- Each slide: headline (bold, short) + body text (2-3 lines max)
- Include caption text for the post (with 5 hashtags)

Output format:
SLIDE 1:
Headline: ...
Body: ...

SLIDE 2:
(etc)

---
CAPTION: (Instagram post caption, 2-3 sentences + hashtags)`;

const THREAD_SYSTEM = `You are a Twitter/X thread writer for Onera. Write a 6-tweet thread about a dream symbol.

Rules:
- Tweet 1: Hook fact or question (make them click "Show more")
- Tweet 2: What the dream actually means (Jungian depth)
- Tweet 3: The body connection — where this emotion is stored
- Tweet 4: The somatic exercise (condensed to 280 chars)
- Tweet 5: Engagement — "Reply with YOUR recurring dream"
- Tweet 6: CTA — link to the full article + app
- Each tweet MUST be under 280 characters
- Use line breaks within tweets for readability
- Thread numbering: 1/6, 2/6, etc.

Output the 6 tweets, separated by ---`;

// ── Generate content ────────────────────────────────────────────────────────
async function generateForSymbol(symbol, format) {
    const summary = extractArticleSummary(symbol.slug);
    if (!summary) {
        console.log(`  ⊘ No article found for ${symbol.slug}`);
        return null;
    }

    const userPrompt = `Dream symbol: "${symbol.symbol}"
Category: ${symbol.category}
Monthly search volume: ${symbol.volume}
Article title: ${summary.title}

Article content summary:
${summary.bodyText}

Generate the ${format} content for this dream symbol.`;

    const systems = {
        tiktok: TIKTOK_SYSTEM,
        carousel: CAROUSEL_SYSTEM,
        thread: THREAD_SYSTEM
    };

    try {
        const content = await callMistral(systems[format], userPrompt);
        return content;
    } catch (e) {
        console.log(`  ✗ Error: ${e.message}`);
        return null;
    }
}

async function saveContent(symbol, format, content) {
    const dirs = { tiktok: 'tiktok-scripts', carousel: 'instagram-carousels', thread: 'twitter-threads' };
    const exts = { tiktok: '.txt', carousel: '.txt', thread: '.txt' };
    const filePath = path.join(OUTPUT_DIR, dirs[format], `${symbol.slug}${exts[format]}`);
    fs.writeFileSync(filePath, `# ${symbol.symbol} — ${format.toUpperCase()}\n# Volume: ${symbol.volume}/mo | Category: ${symbol.category}\n# Generated: ${new Date().toISOString()}\n\n${content}`);
    return filePath;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`
╔══════════════════════════════════════════════╗
║  ONERA Social Content Generator              ║
║  Dream Articles → TikTok / IG / Twitter      ║
╚══════════════════════════════════════════════╝
`);

    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    let symbols = db.symbols;

    // Filter
    if (FILTER_SLUG) symbols = symbols.filter(s => s.slug.includes(FILTER_SLUG));
    if (FILTER_TIER) symbols = symbols.filter(s => s.tier === FILTER_TIER);

    // Only process symbols that have articles
    symbols = symbols.filter(s => fs.existsSync(path.join(ARTICLES_DIR, `${s.slug}.html`)));

    if (LIMIT) symbols = symbols.slice(0, LIMIT);

    const formats = FILTER_FORMAT ? [FILTER_FORMAT] : ['tiktok', 'carousel', 'thread'];

    console.log(`📊 Symbols with articles: ${symbols.length}`);
    console.log(`📝 Formats: ${formats.join(', ')}`);
    console.log(`🤖 Model: ${MISTRAL_MODEL}`);
    if (DRY_RUN) { console.log('\n🔍 DRY RUN — no content will be generated\n'); symbols.forEach(s => console.log(`  ${s.slug} (${s.volume}/mo)`)); return; }

    let total = 0, errors = 0;

    for (const symbol of symbols) {
        for (const format of formats) {
            const outPath = path.join(OUTPUT_DIR,
                format === 'tiktok' ? 'tiktok-scripts' : format === 'carousel' ? 'instagram-carousels' : 'twitter-threads',
                `${symbol.slug}.txt`
            );

            if (fs.existsSync(outPath)) {
                console.log(`  ⊘ ${symbol.slug} [${format}] — exists`);
                continue;
            }

            const ts = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            process.stdout.write(`[${ts}] ${symbol.slug} [${format}]...`);

            const content = await generateForSymbol(symbol, format);
            if (content) {
                await saveContent(symbol, format, content);
                total++;
                console.log(` ✓ (${total})`);
            } else {
                errors++;
                console.log(` ✗`);
            }

            // Rate limit
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.log(`
══════════════════════════════════════════════
  ✓ Generated: ${total}
  ✗ Failed: ${errors}
  📁 Output: ${OUTPUT_DIR}
══════════════════════════════════════════════
`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
