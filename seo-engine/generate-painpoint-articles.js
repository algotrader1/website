#!/usr/bin/env node

/**
 * ONERA Programmatic SEO — Pain-Point Article Generator
 *
 * Generates deep psychological articles targeting pain-point keywords
 * using Mistral API. Each article maps to a CCP angle from VoC research.
 *
 * Usage:
 *   node generate-painpoint-articles.js                    # Generate all pending
 *   node generate-painpoint-articles.js --slug therapy-not-working  # Single article
 *   node generate-painpoint-articles.js --category somatic  # By category
 *   node generate-painpoint-articles.js --limit 1           # Generate 1 (for validation)
 *   node generate-painpoint-articles.js --tier 1            # Only tier 1
 *   node generate-painpoint-articles.js --dry-run           # Preview only
 *   node generate-painpoint-articles.js --concurrency 2     # Parallel requests
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────────────────
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || 'LH6KkRZKdbDMdzvoEdj8JMC8dAewBBEe';
const MISTRAL_MODEL = 'mistral-large-latest';
const OUTPUT_DIR = path.join(__dirname, '..', 'blog', 'posts');
const DB_PATH = path.join(__dirname, 'painpoint-keywords.json');
const LOG_FILE = path.join(__dirname, 'painpoint-generation-log.json');
const RATE_LIMIT_MS = 2500;

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

// ── CPP Links (Custom Product Pages per angle) ──────────────────────────────
const CPP_LINKS = {
  'F1':      'https://apps.apple.com/us/app/onera-dream-integration/id6751126653?ppid=e6154fed-5b4d-4179-b1f8-7c940128f139',
  'F2':      'https://apps.apple.com/us/app/onera-dream-integration/id6751126653?ppid=3dc222a7-2989-42e7-8be2-ab72d5dd7325',
  'F3a':     'https://apps.apple.com/us/app/onera-dream-integration/id6751126653?ppid=1cced7b2-ff40-4d55-a133-f4a80cfe4424',
  'F3b':     'https://apps.apple.com/us/app/onera-dream-integration/id6751126653?ppid=1cced7b2-ff40-4d55-a133-f4a80cfe4424',
  'F4':      'https://apps.apple.com/us/app/onera-dream-integration/id6751126653?ppid=750aa250-6fc5-4e89-bbb4-24df243f8561',
  'F5':      'https://apps.apple.com/us/app/onera-dream-integration/id6751126653?ppid=022c67b0-c455-43cd-af17-b9d711ddad74',
  'M1':      'https://apps.apple.com/us/app/onera-dream-integration/id6751126653?ppid=685f1e25-593a-450c-8758-d1544143430f',
  'M2':      'https://apps.apple.com/us/app/onera-dream-integration/id6751126653?ppid=c9c0065f-a336-4f9a-acdc-44f1f6c13a9d',
  'M3':      'https://apps.apple.com/us/app/onera-dream-integration/id6751126653?ppid=0a920009-d339-4d49-b57e-605043ac4987',
  'M4':      'https://apps.apple.com/us/app/onera-dream-integration/id6751126653?ppid=8541e472-1195-486b-b0f5-1364e08a907e',
  'M5':      'https://apps.apple.com/us/app/onera-dream-integration/id6751126653?ppid=91c9e2f5-9945-4180-9574-c8c381ba07b5',
  'M6':      'https://apps.apple.com/us/app/onera-dream-integration/id6751126653?ppid=91c9e2f5-9945-4180-9574-c8c381ba07b5',
  'M-Shame': 'https://apps.apple.com/us/app/onera-dream-integration/id6751126653?ppid=685f1e25-593a-450c-8758-d1544143430f',
  'general':  'https://apps.apple.com/us/app/onera-dream-integration/id6751126653'
};

// ── CCP Angle Context (from VoC research) ───────────────────────────────────
const CCP_ANGLES = {
  'F1': {
    name: 'Body Disconnection — Body Home (Women 25-42)',
    pain: 'She left her body to survive. Dissociation disguised as calm. Functions perfectly on the outside but feels nothing inside. What looks like strength is anesthesia.',
    driver: 'The fear of spending her whole life "fine" without ever being truly alive. Never feeling her own children, her partner, her own life.',
    language: 'security, coming home to your body, gentle, safe',
    voc: '"Life becomes manageable. Safe, maybe. But flat. Gray. Like watching a movie of your own life instead of living it." — Aspire Counseling. "I feel internally shut down. I\'m present, but not really there." — r/CPTSD. "Good things happen, but I can\'t access the happiness I think I should feel." — Aspire Counseling',
    cta_tone: 'gentle',
    tagline: 'You\'re not broken. You\'re disconnected. There\'s a way back.',
    paywall: 'Finally live in your body.'
  },
  'F2': {
    name: 'Therapy Ceiling — Beyond Therapy (Women 28-42)',
    pain: 'Therapy-literate. Years of CBT, psychodynamic, IFS. She can explain her patterns perfectly but still repeats them. Insight became her ceiling. She needs the body step therapy never provided.',
    driver: 'Accumulated frustration. She has tried EVERYTHING. She\'s starting to believe she\'s "broken." The promise "release what understanding couldn\'t" is exactly what she\'s been looking for.',
    language: 'understanding vs feeling, the gap between knowing and changing, direct',
    voc: '"I\'ve done enough therapy, read enough books, and dissected enough of my childhood to recognize every emotional pattern as it\'s happening. The problem is, knowing why I\'m reacting doesn\'t always stop the reaction." — CPTSD Foundation. "All the logical things don\'t seem to truly get to that core pain. It truly is stored somewhere in my body." — Tiny Buddha',
    cta_tone: 'direct',
    tagline: 'You\'ve understood it for years. Your body still carries it.',
    paywall: 'Release it from your body.'
  },
  'F3a': {
    name: 'Mother Wound — Mother Pattern (Women 28-42)',
    pain: 'She hears her mother\'s words coming from her own mouth. Same coldness, same distance. She spends her energy taking care of everyone else and neglects herself without even noticing. She\'s becoming her.',
    driver: 'The terror of never escaping. Of ending up like her mother. Of transmitting the cycle to her children. Most powerful urgency in the female segment.',
    language: 'breaking the cycle, not passing it on, urgent',
    voc: '"I\'m a broken record, playing the same old song." — MyPTSD Forum. "She feels like a PhD student of her own psyche who still fails the same exam every time." — Avatar Journey. "I kept attracting the same type of person." — VoC pattern',
    cta_tone: 'urgent',
    tagline: 'You can see the cycle. You just can\'t stop it. Until now.',
    paywall: 'Break the cycle. Choose free.'
  },
  'F3b': {
    name: 'Relationship Pattern — Pattern Breaker (Women 25-38)',
    pain: 'She keeps choosing the emotionally unavailable partner. She shrinks to fit. Calls it love. When it ends she swears never again — then meets someone new and recognizes his coldness, his distance. The same pattern.',
    driver: 'The terror of never having a truly reciprocal relationship. Of repeating this for her entire life.',
    language: 'why do I keep choosing the same person, raw',
    voc: '"I feel I can never have a long lasting and meaningful relationship, no matter how hard I try, because of my inability to be truly vulnerable." — r/CPTSD. "I pushed everyone away by lying, being difficult and not allowing myself to heal. I\'m a broken record, playing the same old song." — MyPTSD',
    cta_tone: 'raw',
    tagline: 'You\'re not choosing him. You\'re choosing what love first felt like.',
    paywall: 'Break the cycle. Choose free.'
  },
  'F4': {
    name: 'Recurring Nightmare — Nightmare End (Women 25-40)',
    pain: 'She wakes at 3am in sweat, alone, without tools. Same nightmare for months or years. She\'s starting to dread going to sleep. No one can tell her why it won\'t stop.',
    driver: 'Immediate urgency. She doesn\'t want a life change in 21 days — she wants to sleep TONIGHT without terror. Binary promise: the dream comes back or it doesn\'t.',
    language: 'your body is trying to finish something, the dream keeps coming back because, urgent',
    voc: '"I used to dread going to bed. Waking up shaking at 3am, alone, with no one to call." "Ever since I was 5 years old, I have had a recurring nightmare — word-for-word identical — every single time." — Lucid Dream Leaf. "It keeps coming back because it hasn\'t been heard."',
    cta_tone: 'urgent',
    tagline: 'Same nightmare. Every night. There\'s a reason it won\'t stop.',
    paywall: 'Sleep in peace tonight.'
  },
  'F5': {
    name: 'Emotional Numbness — Feel Again (Women 25-38)',
    pain: 'Complete numbness. No sadness, no joy — just emptiness. She froze to survive and now she can\'t thaw. She performs strength while feeling hollow.',
    driver: 'The fear of being dead inside. Of never feeling love, joy, anything again. The numbness itself smothers the urgency.',
    language: 'thawing, coming back to life, feeling again, gentle',
    voc: '"Good things happen, but I can\'t access the happiness I think I should feel. Celebrations, promotions — they all land flat." — Aspire Counseling. "I hadn\'t cried in over a decade. That took a toll I didn\'t realize was happening." — Sura Flow. "You stopped feeling to survive. It worked too well."',
    cta_tone: 'gentle',
    tagline: 'You\'re not empty. You\'re frozen. Everything is still in there.',
    paywall: 'Feel freely again.'
  },
  'M1': {
    name: 'Wasted Potential — Unlock Potential (Men 25-40)',
    pain: 'He knows he\'s capable of more. He watches others advance. He self-sabotages approaching every breakthrough. Not a discipline problem — something deeper running from his subconscious. Performance framing, not therapy.',
    driver: 'Performance. Wasted potential. The silent rage of watching himself underperform. "Survival mode" and "low power" framing resonates because it translates the problem into performance language.',
    language: 'performance, execution, potential, decode, direct',
    voc: '"Staying in my bedroom and playing video games instead of living. This started when I was 18, I will be 26 in eight days." — Reddit. "The overwhelming feeling is that my life has been wasted." — Ask Polly. "My shadow was sabotaging me." — Substack',
    cta_tone: 'direct',
    tagline: 'Something is holding you back. It\'s not discipline. It\'s not motivation.',
    paywall: 'Run at full power.'
  },
  'M2': {
    name: 'Therapy Ceiling — Body Release (Men 28-45)',
    pain: 'He read The Body Keeps the Score, he gets the concept. But he has no pathway to act on it. His jaw is clenched, shoulders locked, stomach knotted. He\'s done with comprehension — he wants a result, not an insight.',
    driver: 'Efficiency. He\'s sick of "understanding" — he wants something that moves. "Release" framing instead of "heal." He wants a measurable physical result.',
    language: 'what actually works, practical, results-based, body-first, direct',
    voc: '"I bypass feeling the feelings a lot, and intellectualize my healing journey." — r/spirituality. "You can understand your trauma intellectually, explain it perfectly to your therapist, and still get triggered by a certain smell or sound. Your body hasn\'t gotten the memo." — Marie Selleck Therapy. "I spent years seeing over a dozen different therapists, wasted thousands of dollars and got virtually nothing out of it." — Social Anxiety Forum',
    cta_tone: 'direct',
    tagline: 'You see it clearly. Seeing didn\'t fix it.',
    paywall: 'Breathe without the weight.'
  },
  'M3': {
    name: 'Self-Sabotage — Pattern Break (Men 25-40)',
    pain: 'He watches himself destroy everything he builds — relationships, career, progress. He sees the cycle from the outside like a film and can\'t press pause. The pattern runs from his subconscious on automatic.',
    driver: 'Visible destruction. He sees the damage. The relationship that left. The job that exploded. Each cycle = one more relationship destroyed, one more opportunity lost.',
    language: 'subconscious patterns, the part of you running the show, raw',
    voc: '"Because of my inability to actually talk to my wife, instead of shutting her out, I crossed the line and she no longer wants to be with me. I am a broken record, playing the same old song." — MyPTSD. "Every time I got close to a breakthrough, I\'d blow it up." — natural language',
    cta_tone: 'raw',
    tagline: 'You watch yourself do it. Every time. You still can\'t stop.',
    paywall: 'Write a new ending.'
  },
  'M4': {
    name: 'Recurring Nightmare — Dream Decoder (Men 25-45)',
    pain: 'The same nightmare for years — being pursued, teeth falling, someone from his past who refuses to leave. He wakes trembling and pretends it didn\'t happen. He\'s never told anyone.',
    driver: 'The secret. He\'s never told anyone about this dream. The app is private — no judgment. He records his nightmare alone at 3am and something understands it.',
    language: 'your nervous system is trying to complete something, urgent',
    voc: '"For the last 6-7 years, I have been seeing him in my dreams. Every time I wake up, I feel this awful heaviness." — r/Dreams. "A recurring dream where his father appeared, always angry, always critical. His father had been dead for fifteen years." — Bobby Soni. "I\'ve even started having sleep paralysis. That person is crouched by my bed." — r/Dreams',
    cta_tone: 'urgent',
    tagline: 'The dream you\'ve never told anyone about. It\'s trying to tell YOU something.',
    paywall: 'Love the dark again.'
  },
  'M5': {
    name: 'Emotional Numbness — Thaw (Men 28-45)',
    pain: 'Robot mode. Work, gym, routine, feel nothing. Relationships end because he\'s "emotionally unavailable." He doesn\'t even know what that concretely means. He froze to survive and can\'t thaw.',
    driver: 'The relationship. Either the one that just ended ("you\'re not really here"), or the one he\'s trying to save, or the children he wants to raise differently.',
    language: 'not cold — frozen, the shutdown that became your personality, direct',
    voc: '"After what seemed like a LIFETIME of avoiding emotions, you don\'t FEEL, you\'re disconnected from knowing any NEED to feel; you\'re constantly in survival mode." — MyPTSD. "I feel like a robot. But I\'m not. I\'m just a human, trying to remember how to feel." — Medium. "She said I was emotionally unavailable. She was right. I just didn\'t know what to do about it." — Avatar #2. "Nobody. No one." — r/AskMen viral thread',
    cta_tone: 'direct',
    tagline: 'You\'re not empty. You\'re frozen. Your dreams are the last part of you still trying to feel.',
    paywall: 'Burn bright again.'
  },
  'M6': {
    name: 'Father Wound — End the Inheritance (Men 28-42)',
    pain: 'He sees his father\'s pattern turning in him — his anger, his silence, his emotional absence. He hears his father\'s voice in his own words. He\'s terrified of transmitting it to his son. Most powerful driver in the male segment.',
    driver: 'His children. Or the next relationship. The terror of reproducing exactly what he swore to never reproduce. Maximum existential urgency.',
    language: 'stopping what he started, not passing it on, urgent',
    voc: '"It\'s in the easy way I fall into self-criticism, that deep groove. I reflexively repeat my father\'s judgments. There is still part of me that believes because I was never good enough for my father, I\'m not good enough period." — TheMighty. "Am I destined to become my dad?" — VICE. "I\'m in the middle of an argument. The words coming out of my mouth aren\'t mine — they\'re his." — Onera dream',
    cta_tone: 'urgent',
    tagline: 'His anger. His silence. His distance. You swore you\'d be different. But you hear his voice in yours.',
    paywall: 'End what he started.'
  },
  'M-Shame': {
    name: 'Toxic Shame — Drop the Shame (Men 25-42, orphan angle → routes to M-1)',
    pain: 'He carries a shame he can\'t name. Imposter syndrome, replay of an embarrassing moment from 10 years ago, fraud sensation. When asked who he truly confides in — the honest answer is no one.',
    driver: 'Isolation. The deep conviction he\'s the only one feeling this. The secret is the driver — the app is private, no judgment.',
    language: 'the feeling underneath imposter syndrome, inherited shame, raw',
    voc: '"No one." — r/AskMen viral thread. "It\'s hard to let go of a coping mechanism that\'s been with me so long, I don\'t know who I am without it. I feel ashamed for every breath I take." — Reddit. "Most men only know two emotions happy and angry because we\'re told that\'s all we can feel." — r/AskReddit. "I feel so called out yet validated at the same time." — Patrick Teahan viral clip',
    cta_tone: 'raw',
    tagline: 'That shame isn\'t yours. Someone put it there before you could defend yourself.',
    paywall: 'Drop the shame.'
  },
  'general': {
    name: 'General Audience',
    pain: 'Seeking deeper self-understanding through dreams, shadow work, or body awareness.',
    driver: 'The desire to understand what\'s happening beneath conscious awareness.',
    language: 'discovery, understanding, the hidden layer, what your dreams know',
    voc: '"I want to understand why I keep having these dreams." "What is my subconscious trying to tell me?"',
    cta_tone: 'neutral',
    tagline: 'Your dreams are trying to tell you something.',
    paywall: 'Decode what your dreams already know.'
  }
};

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
      max_tokens: 10000
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
    req.setTimeout(180000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

// ── System Prompt ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a depth psychologist and writer who combines:
- Jungian depth psychology (shadow work, archetypes, the unconscious, dream analysis)
- Bessel van der Kolk's research ("The Body Keeps the Score")
- Peter Levine's Somatic Experiencing framework
- Polyvagal theory (Stephen Porges)
- Modern neuroscience of the subconscious mind

You write articles for Onera — an app that uses AI to decode dreams, reveal subconscious patterns, and guide personalized somatic release exercises. Onera's unique mechanism: Dream Symbol → Subconscious Pattern → Body Location → Somatic Release.

THE CORE INSIGHT: The subconscious mind communicates through dreams, body sensations, and repetitive patterns. What people can't figure out consciously, their dreams already know. Onera decodes that layer.

CRITICAL COPY RULES (never break these):
- NEVER say "heal your trauma" — say "release what's stored" or "complete what started"
- NEVER dismiss therapy — position dream/subconscious work as complementary, the missing piece
- NEVER be salesy or pushy — be a wise, warm guide who understands deeply
- For female-oriented topics: use SECURITY language (safe, grounded, held, coming home to yourself)
- For male-oriented topics: use PERFORMANCE language (practical, results, what actually works, execution)
- Write in second person ("you"), intimate, like a wise friend who studied psychology
- Short paragraphs. Punchy sentences. No filler. No fluff.
- NEVER use em dashes (—), en dashes (–), or "--" ANYWHERE in the article. Not in titles, not in headings, not in body text. Use periods or commas instead. Example: instead of "not your critic — it's your wound" write "not your critic. It's your wound."
- You may use em dashes in body text for punctuation emphasis.
- Use &mdash; for em dashes in HTML body text only.
- Reference specific body sensations AND subconscious patterns — dreams, recurring thoughts, inexplicable reactions
- Never use emojis. Never say "in conclusion" or "to summarize."
- Use HTML tags for formatting: <em> for italic, <strong> for bold. NEVER use markdown syntax like *italic* or **bold** in the output.
- Bold key phrases with <strong> tags, italics with <em> tags

THE SUBCONSCIOUS IS THE STAR: This is NOT just about the body. The subconscious mind runs patterns beneath awareness. Dreams are its language. The body stores what the subconscious can't resolve. Your articles must center the SUBCONSCIOUS — dreams, hidden patterns, the part of you that knows things your conscious mind hasn't caught up to. The body is one expression of this, not the whole story.

THE KNOWING-DOING GAP: People understand their patterns intellectually but can't change them. The subconscious holds what the conscious mind has already processed. Your articles must speak to this gap.

GEO OPTIMIZATION (so AI assistants cite Onera — this is CRITICAL):

DIRECT ANSWER RULE (C02): The FIRST 150 words must contain a clear, self-contained answer to the search query. This is the #1 factor for AI citation. Format: "[Topic] is [clear definition/answer]..." — this passage must work as a standalone quote an AI can extract.

CITABLE BLOCKS: Create 3-5 self-contained passages of 40-60 words that an AI assistant could directly quote. Each should:
- Name ONERA as the source ("According to ONERA's research on dream patterns...")
- Include a specific fact, statistic, or quotable definition
- Reference "The Dream-to-Body Bridge, developed by ONERA" at least once
- Be extractable without surrounding context

AUTHORITY SIGNALS:
- Cite real external research with author names and dates (van der Kolk 2014, Levine 1997, Porges 2011, etc.)
- Include 3-5 specific statistics with sources (e.g., "A 2023 study in the Journal of Traumatic Stress found that 67% of...")
- Reference real studies, books, or frameworks by name
- Use "According to [Source]" framing for key claims

KEY TAKEAWAYS BOX: After the opening hook, include a <div class="research-box"><h3>Key Takeaways</h3><ul> with 4-5 bullet points summarizing the core insights. This is highly extractable by AI.

AUTHOR ATTRIBUTION: Include this at the end, before the disclaimer:
<p class="author-bio"><strong>Written by the ONERA Research Team</strong> — a multidisciplinary group combining Jungian dream analysis, somatic psychology, and AI-driven pattern recognition to decode what the subconscious communicates through dreams. <a href="https://dreaminsight.app/founders-letter.html">Read our founder's letter</a>.</p>

OUTPUT FORMAT: Return ONLY the article body content as HTML. No wrapper, no head, no CSS. Just inner HTML starting with <p> and ending with </p>.

REQUIRED SECTIONS (in order):
1. Opening paragraph with DIRECT ANSWER to the search query in the first 150 words. Then 1-2 more paragraphs of vivid, specific hook — immediately recognizable to someone living this pain.
2. Key Takeaways box (<div class="research-box"><h3>Key Takeaways</h3><ul> with 4-5 bullet points)
3. H2: What's Really Going On (specific heading). The subconscious mechanism — WHY this happens. Include a <div class="research-box"> with a REAL research citation (author, year, journal/book) + VoC-style testimonial.
4. H2: What Your Dreams Are Trying to Tell You (connect this pain point to specific dream patterns. Be specific about dream symbols and what the subconscious communicates. This is a KEY section.)
5. H2: Where Your Subconscious Stores This (3-5 body locations in a table. Frame as subconscious expression, not just body.)
6. H2: A Somatic Release Exercise (in a <div class="research-box">. 4-5 steps. Explain the neuroscience of WHY it works.)
7. H2: Why Understanding Isn't Enough (the knowing-doing gap. Why insight alone fails. Why dreams + body work together.)
8. HR + CTA div (use {{CTA_LINK}} as href)
9. HR + H2: Frequently Asked Questions (4-5 questions. H3 + 40-60 word direct answers — optimal for AI extraction.)
10. HR + Author bio paragraph
11. HR + Disclaimer paragraph
12. Related articles div (5 links)

FOR THE CTA: Use this exact HTML structure:
<div class="article-cta">
    <h3>[Short, specific heading about what's possible]</h3>
    <p>[2-3 sentences: what Onera does for THIS issue. Warm tone.]</p>
    <a href="{{CTA_LINK}}" target="_blank">Try Onera Free &rarr;</a>
</div>

FOR RELATED ARTICLES: Include a div with exactly 5 links to thematically related articles using these slugs:
therapy-not-working, emotional-numbness, recurring-nightmares-meaning, where-trauma-stored-in-body, self-sabotage-why, mother-wound-healing, father-wound-healing, emotionally-unavailable-partner-pattern, body-disconnection-dissociation, somatic-exercises-anxiety, shadow-work-beginners, imposter-syndrome-shame, trauma-healing-without-therapy, body-keeps-the-score-exercises, waking-up-at-3am, nervous-system-dysregulation, signs-body-releasing-trauma, why-do-i-feel-nothing, generational-trauma-breaking-cycle, people-pleasing-trauma-response, freeze-response-trauma, dreams-about-ex-wont-stop, dreams-about-dead-father, dreams-about-dead-mother

Use: <div class="related-dreams"> with <a href="/blog/posts/SLUG.html">Link Text</a>`;

// ── Build Prompt ────────────────────────────────────────────────────────────
function buildPrompt(keyword) {
  // Resolve CCP angle(s)
  const angles = keyword.angle.split('/').map(a => a.trim());
  const angleContexts = angles.map(a => CCP_ANGLES[a] || CCP_ANGLES['general']);

  const angleDescription = angleContexts.map(a =>
    `ANGLE: ${a.name}\nPAIN: ${a.pain}\nDRIVER: ${a.driver}\nLANGUAGE REGISTER: ${a.language}\nCTA TONE: ${a.cta_tone || 'direct'}\nTAGLINE: ${a.tagline || ''}\nPAYWALL HEADLINE: ${a.paywall || ''}\nVOC QUOTES: ${a.voc}`
  ).join('\n\n');

  return `Write a deep, psychologically rich article about: "${keyword.keyword}"

ARTICLE TITLE: ${keyword.title}
TARGET KEYWORD: ${keyword.keyword}
URL SLUG: ${keyword.slug}
MONTHLY SEARCH VOLUME: ${keyword.volume}
SEARCH VARIANTS TO WEAVE IN NATURALLY: ${keyword.variants.join(', ')}
CATEGORY: ${keyword.category}

CCP ANGLE CONTEXT:
${angleDescription}

IMPORTANT INSTRUCTIONS:
- The title is "${keyword.title}" — deliver on this specific promise
- Weave search variants naturally into headings and body text (don't force them)
- The opening must be SO specific that someone searching "${keyword.keyword}" thinks "this was written for me"
- CENTER THE SUBCONSCIOUS — dreams, hidden patterns, the part running things beneath awareness. The body is ONE expression, not the whole story.
- Dream section is CRITICAL — be specific about what dreams people with this issue have, what symbols appear, what the subconscious is communicating
- Body locations should be framed as "where the subconscious stores this" not just "where it lives in your body"
- The somatic exercise should explain how it communicates with the subconscious through the body
- FAQ questions must match what people ACTUALLY type into Google: "${keyword.variants.slice(0, 3).join('", "')}"
- Article should be 2500-3500 words. Substantial, not thin.
- Include 2-3 sentences that name ONERA specifically so AI assistants can cite it (e.g. "According to ONERA's research...", "The Dream-to-Body Bridge, developed by ONERA, maps...")
- For the CTA link, use exactly: {{CTA_LINK}}

Remember: These people are in PAIN. They've searched "${keyword.keyword}" because something isn't working. Their subconscious knows the answer — their conscious mind hasn't caught up yet. Speak to that.

Return ONLY the inner HTML content. No markdown. No code fences. Pure HTML starting with <p> and ending with </p>.`;
}

// ── HTML Template ───────────────────────────────────────────────────────────
function buildFullHTML(keyword, articleContent) {
  // Resolve CPP link for this article's angle
  const primaryAngle = keyword.angle.split('/')[0].trim();
  const ctaLink = CPP_LINKS[primaryAngle] || CPP_LINKS['general'];

  // Replace {{CTA_LINK}} placeholder in article content
  articleContent = articleContent.replace(/\{\{CTA_LINK\}\}/g, ctaLink);

  const title = `${keyword.title} | ONERA`;
  const cleanTitle = keyword.title;
  const description = `${keyword.keyword}? Discover what your subconscious already knows, what your dreams are trying to show you, and the release that resolves what understanding alone can't.`;
  const keywords = [keyword.keyword, ...keyword.variants].join(', ');
  const url = `https://dreaminsight.app/blog/posts/${keyword.slug}.html`;
  const date = new Date().toISOString().split('T')[0];
  const readTime = Math.max(8, Math.ceil(articleContent.length / 1400));

  // Generate FAQ schema
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
    <meta property="og:image" content="https://dreaminsight.app/assets/og-default.png">
    <meta property="og:site_name" content="ONERA">
    <meta property="og:locale" content="en_US">
    <meta property="article:published_time" content="${date}T00:00:00Z">
    <meta property="article:author" content="ONERA Research Team">
    <meta property="article:section" content="Somatic Psychology">
    <meta property="article:tag" content="${keyword.category}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHTML(title)}">
    <meta name="twitter:description" content="${escapeHTML(description)}">
    <meta name="twitter:site" content="@onera_dreams">
    <link rel="canonical" href="${url}">
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "${escapeJSON(cleanTitle)}",
        "author": {"@type": "Organization", "name": "ONERA Research Team", "url": "https://dreaminsight.app"},
        "publisher": {"@type": "Organization", "name": "ONERA", "url": "https://dreaminsight.app"},
        "datePublished": "${date}",
        "dateModified": "${date}",
        "description": "${escapeJSON(description)}",
        "mainEntityOfPage": "${url}",
        "keywords": "${escapeJSON(keywords)}"
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
        .body-map-table { width: 100%; border-collapse: collapse; margin: 2rem 0; }
        .body-map-table th, .body-map-table td { text-align: left; padding: 0.875rem 1rem; border-bottom: 1px solid var(--line); font-size: 0.95rem; }
        .body-map-table th { color: var(--fg-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.8rem; background: var(--bg-warm); }
        .body-map-table td { color: var(--fg-2); }
        hr { border: none; border-top: 1px solid var(--line); margin: 2.5rem 0; }
        .breadcrumb { font-size: 0.8rem; color: var(--fg-muted); margin-bottom: 1rem; }
        .breadcrumb a { color: var(--fg-3); text-decoration: none; }
        .breadcrumb a:hover { color: var(--fg); }
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
            <a href="${ctaLink}" target="_blank" class="nav-cta">Download</a>
        </div>
    </nav>

    <div class="article-container">
        <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="/">Home</a> &rsaquo; <a href="/blog">Blog</a> &rsaquo; <span>${escapeHTML(cleanTitle)}</span>
        </nav>

        <a href="/blog/" class="back-link">
            <span class="back-arrow">&larr;</span>
            Back to Blog
        </a>

        <header class="article-header">
            <div class="article-meta">
                <span>${formatDate(date)}</span>
                <span>&#9201; ${readTime} min read</span>
            </div>
            <h1 class="article-title">${escapeHTML(cleanTitle)}</h1>
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

    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://dreaminsight.app/"},
            {"@type": "ListItem", "position": 2, "name": "Blog", "item": "https://dreaminsight.app/blog"},
            {"@type": "ListItem", "position": 3, "name": "${escapeJSON(cleanTitle)}"}
        ]
    }
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
  const faqSection = html.split(/FAQ|Frequently Asked/i).pop() || '';
  const h3Regex = /<h3>(.*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = h3Regex.exec(faqSection)) !== null) {
    faqs.push({
      question: match[1].replace(/<[^>]+>/g, '').trim(),
      answer: match[2].replace(/<[^>]+>/g, '').replace(/&mdash;/g, '\u2014').replace(/&rsquo;/g, "'").replace(/&ldquo;/g, '\u201c').replace(/&rdquo;/g, '\u201d').trim()
    });
  }
  return faqs;
}


function cleanContent(content) {
  content = content.replace(/^```html?\s*/i, '').replace(/\s*```\s*$/, '');
  content = content.trim();
  content = content.replace(/<article[^>]*>\s*/gi, '').replace(/<\/article>\s*/gi, '');
  content = content.replace(/<table>/gi, '<table class="variation-table">');
  // Fix smart quotes and special characters to HTML entities
  content = content.replace(/\uFFFD+/g, '&rsquo;'); // Fix broken replacement chars (Mistral encoding issue)
  content = content.replace(/\u2018/g, '&lsquo;');  // '
  content = content.replace(/\u2019/g, '&rsquo;');  // '
  content = content.replace(/\u201C/g, '&ldquo;');  // "
  content = content.replace(/\u201D/g, '&rdquo;');  // "
  content = content.replace(/\u2014/g, '. ');          // — → period (no em dashes)
  content = content.replace(/\u2013/g, '. ');          // – → period (no en dashes)
  content = content.replace(/&mdash;/g, '. ');         // &mdash; → period
  content = content.replace(/&ndash;/g, '. ');         // &ndash; → period
  content = content.replace(/ \. /g, '. ');            // clean up double spaces around periods
  content = content.replace(/\u2026/g, '&hellip;');    // …
  // Convert markdown *italic* to <em> (Mistral sometimes outputs raw markdown)
  content = content.replace(/(?<![*])\*([^*\n]+)\*(?![*])/g, '<em>$1</em>');
  // Replace generic App Store links with {{CTA_LINK}} placeholder (will be resolved in buildFullHTML)
  content = content.replace(/https:\/\/apps\.apple\.com\/app\/onera\/id6751126653/g, '{{CTA_LINK}}');
  // Fix related article links
  content = content.replace(/href="([a-z-]+)"(?!.*\.html)(?!.*http)/gi, (match, slug) => {
    if (slug.includes('-') && !slug.includes('.')) {
      return `href="/blog/posts/${slug}.html"`;
    }
    return match;
  });
  if (!content.startsWith('<')) {
    content = '<p>' + content;
  }
  return content;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Log ─────────────────────────────────────────────────────────────────────
function loadLog() {
  try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8')); }
  catch { return { generated: [], errors: [], stats: { total: 0, success: 0, failed: 0 } }; }
}

function saveLog(log) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551  ONERA \u2014 Pain-Point SEO Engine                \u2551');
  console.log('\u2551  Mistral API \u00d7 VoC Psychology \u00d7 GEO            \u2551');
  console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n');

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const log = loadLog();

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Filter articles
  let articles = db.filter(a => !a.done);

  // Skip already generated
  articles = articles.filter(a => {
    const filePath = path.join(OUTPUT_DIR, `${a.slug}.html`);
    if (fs.existsSync(filePath)) {
      console.log(`  \u2298 ${a.slug} \u2014 already exists, skipping`);
      return false;
    }
    return true;
  });

  if (TIER_FILTER) articles = articles.filter(a => a.tier === TIER_FILTER);
  if (SLUG_FILTER) articles = articles.filter(a => a.slug.includes(SLUG_FILTER));
  if (CAT_FILTER) articles = articles.filter(a => a.category === CAT_FILTER);
  articles = articles.slice(0, LIMIT);

  // Highest volume first
  articles.sort((a, b) => b.volume - a.volume);

  console.log(`Database: ${db.length} pain-point keywords`);
  console.log(`To generate: ${articles.length} articles`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Model: ${MISTRAL_MODEL}`);
  if (DRY_RUN) console.log('DRY RUN \u2014 no files will be created');
  console.log('');

  if (articles.length === 0) {
    console.log('Nothing to generate. All articles exist or filters returned empty.');
    return;
  }

  if (DRY_RUN) {
    articles.forEach(a => console.log(`  Would generate: ${a.slug} (${a.category}, tier ${a.tier}, ${a.volume}/mo)`));
    console.log(`\nTotal: ${articles.length} articles`);
    return;
  }

  let completed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < articles.length; i += CONCURRENCY) {
    const batch = articles.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (article) => {
      const ts = new Date().toLocaleTimeString();
      console.log(`[${ts}] Generating: ${article.slug} (${article.category}, ${article.volume}/mo)...`);

      try {
        const prompt = buildPrompt(article);
        const rawContent = await callMistral(prompt, SYSTEM_PROMPT);
        const content = cleanContent(rawContent);
        const html = buildFullHTML(article, content);

        const filePath = path.join(OUTPUT_DIR, `${article.slug}.html`);
        fs.writeFileSync(filePath, html);

        completed++;
        log.generated.push({ slug: article.slug, date: new Date().toISOString(), chars: html.length, volume: article.volume });
        console.log(`  \u2713 ${article.slug} \u2014 ${(html.length / 1024).toFixed(1)}KB (${completed}/${articles.length})`);
      } catch (err) {
        failed++;
        log.errors.push({ slug: article.slug, date: new Date().toISOString(), error: err.message });
        console.error(`  \u2717 ${article.slug} \u2014 ${err.message}`);
      }
    });

    await Promise.all(promises);

    if (i + CONCURRENCY < articles.length) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  // Update log
  log.stats.total += completed + failed;
  log.stats.success += completed;
  log.stats.failed += failed;
  saveLog(log);

  // Mark as done in the database
  if (completed > 0) {
    const generatedSlugs = new Set(log.generated.map(g => g.slug));
    for (const article of db) {
      if (generatedSlugs.has(article.slug)) {
        article.done = true;
      }
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log(`Done in ${elapsed}s`);
  console.log(`  Generated: ${completed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Output: ${OUTPUT_DIR}`);
  console.log(`  Log: ${LOG_FILE}`);
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
