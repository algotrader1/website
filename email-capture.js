/**
 * ONERA Email Capture System v3
 * Popup + Inline email signup for dream symbol guide lead magnet
 *
 * CRO improvements (v3 — popup-cro skill audit):
 * - Exit intent detection (desktop)
 * - Mobile bottom slide-up (65/35 mobile-heavy traffic)
 * - Smarter timing: 20s for blog posts, 35s for landing page (was 15/30 — less aggressive per skill)
 * - Scroll threshold 40%
 * - Page-count trigger: show after 2+ page visits (research behavior — dream searchers look up multiple symbols)
 * - Once-per-session guard (max 1 popup per session, per skill recommendation)
 * - 7-day localStorage cooldown after dismiss
 * - Converted-user exclusion (isSubscribed check)
 * - Lead magnet visual preview (guide cover image/icon — "show what they get")
 * - First-person CTA ("Send Me the Guide" > "Get the free guide")
 * - Benefit-driven headline ("Decode 50 dream symbols in 5 minutes")
 * - Instant delivery expectation set in copy
 * - Email typo detection (common domain misspellings)
 * - Polite decline link (not guilt-trippy)
 * - Honest success state
 * - Full accessibility: focus trap, aria attrs, keyboard nav
 * - Mobile touch targets: min 44-48px on all interactive elements
 * - Analytics tracking: popup_view, form_focus, submit_attempt, submit_success,
 *   close_click, decline_click (fire-and-forget to Supabase popup_events)
 */

(function() {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================
  var SUPABASE_URL = 'https://cxtoofvckqllsasriczb.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4dG9vZnZja3FsbHNhc3JpY3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0MTY1MTYsImV4cCI6MjA1ODk5MjUxNn0.NcM2K_iwXmu8XqxlXAtYECzzuGSrkaeM6ILxzPXmKkY';
  var ENDPOINT = SUPABASE_URL + '/rest/v1/email_subscribers';
  var EVENTS_ENDPOINT = SUPABASE_URL + '/rest/v1/popup_events';

  var SCROLL_THRESHOLD = 0.4;        // 40% of article
  var DISMISS_COOLDOWN_DAYS = 7;     // Days before showing again after dismiss
  var MIN_PAGES_FOR_POPUP = 2;       // Show popup only after 2+ page visits (research behavior)

  // Detect page type for timing — 20s for blogs (was 15, less aggressive per skill), 35s for landing
  function isBlogPost() {
    var path = window.location.pathname;
    return path.indexOf('/blog/') !== -1 || path.indexOf('/posts/') !== -1 || path.indexOf('-meaning') !== -1 || path.indexOf('-dream') !== -1;
  }
  var POPUP_DELAY_MS = isBlogPost() ? 20000 : 35000;

  function isMobile() {
    return window.innerWidth < 768;
  }

  // ============================================================
  // ANALYTICS TRACKING
  // ============================================================
  function trackEvent(eventName, meta) {
    try {
      var payload = {
        event: eventName,
        page_url: window.location.pathname,
        device: isMobile() ? 'mobile' : 'desktop',
        timestamp: new Date().toISOString()
      };
      if (meta) payload.meta = JSON.stringify(meta);

      // Use sendBeacon for reliability (doesn't block navigation/unload)
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(
          EVENTS_ENDPOINT + '?apikey=' + SUPABASE_ANON_KEY,
          blob
        );
      } else {
        fetch(EVENTS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(payload)
        }).catch(function() {});
      }
    } catch(e) {
      // Analytics should never break the popup
    }
  }

  // ============================================================
  // PAGE COUNT TRACKING (session-based, for research behavior detection)
  // ============================================================
  function getPageCount() {
    try {
      return parseInt(sessionStorage.getItem('onera_page_count') || '0', 10);
    } catch(e) { return 0; }
  }

  function incrementPageCount() {
    try {
      var count = getPageCount() + 1;
      sessionStorage.setItem('onera_page_count', String(count));
      return count;
    } catch(e) { return 1; }
  }

  // ============================================================
  // STYLES (injected into <head>)
  // ============================================================
  var styles = document.createElement('style');
  styles.textContent = '\
/* ---- Popup Overlay (Desktop) ---- */\n\
.onera-popup-overlay {\n\
  position: fixed;\n\
  inset: 0;\n\
  z-index: 99999;\n\
  background: rgba(26, 25, 23, 0.45);\n\
  backdrop-filter: blur(6px);\n\
  -webkit-backdrop-filter: blur(6px);\n\
  display: flex;\n\
  align-items: center;\n\
  justify-content: center;\n\
  opacity: 0;\n\
  visibility: hidden;\n\
  transition: opacity 0.35s ease, visibility 0.35s ease;\n\
  padding: 1rem;\n\
}\n\
.onera-popup-overlay.onera-visible {\n\
  opacity: 1;\n\
  visibility: visible;\n\
}\n\
\n\
/* ---- Popup Modal (Desktop) ---- */\n\
.onera-popup {\n\
  background: #f8f6f3;\n\
  border-radius: 20px;\n\
  max-width: 440px;\n\
  width: 100%;\n\
  padding: 2.5rem 2rem 2rem;\n\
  position: relative;\n\
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);\n\
  transform: translateY(20px);\n\
  transition: transform 0.35s ease;\n\
  font-family: \'Inter\', -apple-system, BlinkMacSystemFont, sans-serif;\n\
}\n\
.onera-popup-overlay.onera-visible .onera-popup {\n\
  transform: translateY(0);\n\
}\n\
\n\
/* ---- Mobile Bottom Sheet ---- */\n\
.onera-mobile-sheet {\n\
  position: fixed;\n\
  bottom: 0;\n\
  left: 0;\n\
  right: 0;\n\
  z-index: 99999;\n\
  transform: translateY(100%);\n\
  transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);\n\
}\n\
.onera-mobile-sheet.onera-visible {\n\
  transform: translateY(0);\n\
}\n\
.onera-mobile-sheet .onera-mobile-backdrop {\n\
  position: fixed;\n\
  inset: 0;\n\
  background: rgba(26, 25, 23, 0.35);\n\
  opacity: 0;\n\
  transition: opacity 0.35s ease;\n\
  z-index: -1;\n\
}\n\
.onera-mobile-sheet.onera-visible .onera-mobile-backdrop {\n\
  opacity: 1;\n\
}\n\
.onera-mobile-sheet .onera-popup {\n\
  border-radius: 20px 20px 0 0;\n\
  max-width: 100%;\n\
  padding: 1.5rem 1.25rem 2rem;\n\
  padding-bottom: calc(2rem + env(safe-area-inset-bottom, 0px));\n\
  box-shadow: 0 -10px 40px rgba(0,0,0,0.12);\n\
}\n\
.onera-mobile-sheet .onera-mobile-handle {\n\
  width: 36px;\n\
  height: 4px;\n\
  background: rgba(0,0,0,0.15);\n\
  border-radius: 2px;\n\
  margin: 0 auto 1rem;\n\
}\n\
\n\
/* Close button — 44px touch target */\n\
.onera-popup-close {\n\
  position: absolute;\n\
  top: 0.75rem;\n\
  right: 0.75rem;\n\
  background: none;\n\
  border: none;\n\
  font-size: 1.4rem;\n\
  color: #8a8780;\n\
  cursor: pointer;\n\
  width: 44px;\n\
  height: 44px;\n\
  display: flex;\n\
  align-items: center;\n\
  justify-content: center;\n\
  border-radius: 50%;\n\
  transition: background 0.2s, color 0.2s;\n\
  line-height: 1;\n\
}\n\
.onera-popup-close:hover {\n\
  background: rgba(0,0,0,0.06);\n\
  color: #1a1917;\n\
}\n\
.onera-popup-close:focus-visible {\n\
  outline: 2px solid #c4956a;\n\
  outline-offset: 2px;\n\
}\n\
\n\
/* Lead magnet visual preview — "show what they get" */\n\
.onera-popup-preview {\n\
  display: flex;\n\
  align-items: center;\n\
  gap: 1rem;\n\
  margin-bottom: 1.25rem;\n\
}\n\
.onera-popup-cover {\n\
  flex-shrink: 0;\n\
  width: 56px;\n\
  height: 72px;\n\
  background: linear-gradient(145deg, #c4956a 0%, #8b6b4a 100%);\n\
  border-radius: 6px;\n\
  display: flex;\n\
  flex-direction: column;\n\
  align-items: center;\n\
  justify-content: center;\n\
  box-shadow: 0 4px 12px rgba(196, 149, 106, 0.3);\n\
  position: relative;\n\
  overflow: hidden;\n\
}\n\
.onera-popup-cover::before {\n\
  content: \'\';\n\
  position: absolute;\n\
  inset: 3px;\n\
  border: 1px solid rgba(255,255,255,0.2);\n\
  border-radius: 4px;\n\
}\n\
.onera-popup-cover-icon {\n\
  font-size: 1.5rem;\n\
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));\n\
}\n\
.onera-popup-cover-label {\n\
  position: absolute;\n\
  bottom: 5px;\n\
  left: 0;\n\
  right: 0;\n\
  font-size: 0.45rem;\n\
  font-weight: 600;\n\
  color: rgba(255,255,255,0.9);\n\
  text-align: center;\n\
  text-transform: uppercase;\n\
  letter-spacing: 0.05em;\n\
}\n\
.onera-popup-preview-text {\n\
  flex: 1;\n\
}\n\
\n\
/* Lead magnet badge */\n\
.onera-popup-badge {\n\
  display: inline-flex;\n\
  align-items: center;\n\
  gap: 0.4rem;\n\
  background: rgba(196, 149, 106, 0.1);\n\
  color: #c4956a;\n\
  font-size: 0.8rem;\n\
  font-weight: 500;\n\
  padding: 0.35rem 0.85rem;\n\
  border-radius: 50px;\n\
  margin-bottom: 0.75rem;\n\
  letter-spacing: 0.01em;\n\
}\n\
\n\
/* Headline */\n\
.onera-popup h2 {\n\
  font-size: 1.5rem;\n\
  font-weight: 600;\n\
  color: #1a1917;\n\
  margin: 0 0 0.4rem;\n\
  line-height: 1.3;\n\
  letter-spacing: -0.01em;\n\
}\n\
\n\
/* Subtext */\n\
.onera-popup p.onera-popup-sub {\n\
  font-size: 0.92rem;\n\
  color: #5c5a56;\n\
  line-height: 1.55;\n\
  margin: 0 0 1.25rem;\n\
}\n\
\n\
/* Instant delivery note */\n\
.onera-popup-instant {\n\
  display: flex;\n\
  align-items: center;\n\
  gap: 0.35rem;\n\
  font-size: 0.78rem;\n\
  color: #8a8780;\n\
  margin-bottom: 1rem;\n\
}\n\
\n\
/* Visible label for accessibility */\n\
.onera-popup-label {\n\
  display: block;\n\
  font-size: 0.82rem;\n\
  font-weight: 500;\n\
  color: #5c5a56;\n\
  margin-bottom: 0.35rem;\n\
}\n\
\n\
/* Email typo suggestion */\n\
.onera-typo-suggestion {\n\
  font-size: 0.82rem;\n\
  color: #c4956a;\n\
  margin-top: 0.35rem;\n\
  cursor: pointer;\n\
  transition: color 0.2s;\n\
}\n\
.onera-typo-suggestion:hover {\n\
  color: #b5854f;\n\
  text-decoration: underline;\n\
}\n\
\n\
/* Form row */\n\
.onera-popup-form {\n\
  display: flex;\n\
  flex-direction: column;\n\
  gap: 0.75rem;\n\
}\n\
.onera-popup-form input[type="email"] {\n\
  width: 100%;\n\
  padding: 0.85rem 1rem;\n\
  min-height: 48px;\n\
  border: 1px solid rgba(0,0,0,0.1);\n\
  border-radius: 12px;\n\
  font-size: 1rem;\n\
  font-family: \'Inter\', sans-serif;\n\
  background: #fff;\n\
  color: #1a1917;\n\
  outline: none;\n\
  transition: border-color 0.2s;\n\
  box-sizing: border-box;\n\
}\n\
.onera-popup-form input[type="email"]:focus {\n\
  border-color: #c4956a;\n\
  box-shadow: 0 0 0 3px rgba(196, 149, 106, 0.15);\n\
}\n\
.onera-popup-form input[type="email"]:focus-visible {\n\
  outline: 2px solid #c4956a;\n\
  outline-offset: -2px;\n\
  border-color: transparent;\n\
  box-shadow: 0 0 0 3px rgba(196, 149, 106, 0.15);\n\
}\n\
.onera-popup-form input[type="email"]::placeholder {\n\
  color: #b5b3ae;\n\
}\n\
.onera-popup-form button[type="submit"] {\n\
  width: 100%;\n\
  padding: 0.85rem 1.5rem;\n\
  min-height: 48px;\n\
  background: #c4956a;\n\
  color: #fff;\n\
  border: none;\n\
  border-radius: 12px;\n\
  font-size: 1rem;\n\
  font-weight: 500;\n\
  font-family: \'Inter\', sans-serif;\n\
  cursor: pointer;\n\
  transition: background 0.2s, transform 0.15s;\n\
}\n\
.onera-popup-form button[type="submit"]:hover {\n\
  background: #b5854f;\n\
}\n\
.onera-popup-form button[type="submit"]:active {\n\
  transform: scale(0.98);\n\
}\n\
.onera-popup-form button[type="submit"]:disabled {\n\
  opacity: 0.6;\n\
  cursor: not-allowed;\n\
}\n\
.onera-popup-form button[type="submit"]:focus-visible {\n\
  outline: 2px solid #1a1917;\n\
  outline-offset: 2px;\n\
}\n\
\n\
/* Decline link — 44px touch target */\n\
.onera-popup-decline {\n\
  display: block;\n\
  background: none;\n\
  border: none;\n\
  color: #8a8780;\n\
  font-size: 0.82rem;\n\
  font-family: \'Inter\', sans-serif;\n\
  text-align: center;\n\
  cursor: pointer;\n\
  padding: 0.75rem 0;\n\
  margin: 0;\n\
  width: 100%;\n\
  min-height: 44px;\n\
  transition: color 0.2s;\n\
  text-decoration: none;\n\
}\n\
.onera-popup-decline:hover {\n\
  color: #5c5a56;\n\
}\n\
.onera-popup-decline:focus-visible {\n\
  outline: 2px solid #c4956a;\n\
  outline-offset: 2px;\n\
  border-radius: 4px;\n\
}\n\
\n\
/* Privacy note */\n\
.onera-popup-privacy {\n\
  font-size: 0.75rem;\n\
  color: #8a8780;\n\
  margin-top: 0.5rem;\n\
  text-align: center;\n\
}\n\
\n\
/* Success / error messages */\n\
.onera-popup-msg {\n\
  text-align: center;\n\
  padding: 1rem 0;\n\
}\n\
.onera-popup-msg.onera-success {\n\
  color: #1a1917;\n\
  font-size: 1.1rem;\n\
  font-weight: 500;\n\
}\n\
.onera-popup-msg.onera-success .onera-success-sub {\n\
  display: block;\n\
  font-size: 0.88rem;\n\
  font-weight: 400;\n\
  color: #5c5a56;\n\
  margin-top: 0.5rem;\n\
  line-height: 1.5;\n\
}\n\
.onera-popup-msg.onera-error {\n\
  color: #c0392b;\n\
  font-size: 0.9rem;\n\
}\n\
\n\
/* ---- Inline Email Box ---- */\n\
.onera-inline-capture {\n\
  background: rgba(196, 149, 106, 0.08);\n\
  border: 1px solid rgba(196, 149, 106, 0.2);\n\
  border-radius: 16px;\n\
  padding: 2rem;\n\
  margin: 2.5rem 0;\n\
  font-family: \'Inter\', -apple-system, BlinkMacSystemFont, sans-serif;\n\
}\n\
.onera-inline-badge {\n\
  display: inline-flex;\n\
  align-items: center;\n\
  gap: 0.4rem;\n\
  font-size: 0.85rem;\n\
  font-weight: 600;\n\
  color: #c4956a;\n\
  margin-bottom: 0.5rem;\n\
}\n\
.onera-inline-capture p.onera-inline-sub {\n\
  font-size: 0.9rem;\n\
  color: #5c5a56;\n\
  margin: 0 0 1.25rem;\n\
  line-height: 1.5;\n\
}\n\
.onera-inline-form {\n\
  display: flex;\n\
  gap: 0.6rem;\n\
  align-items: stretch;\n\
}\n\
.onera-inline-form input[type="email"] {\n\
  flex: 1;\n\
  min-width: 0;\n\
  padding: 0.7rem 1rem;\n\
  min-height: 48px;\n\
  border: 1px solid rgba(0,0,0,0.1);\n\
  border-radius: 10px;\n\
  font-size: 0.9rem;\n\
  font-family: \'Inter\', sans-serif;\n\
  background: #fff;\n\
  color: #1a1917;\n\
  outline: none;\n\
  transition: border-color 0.2s;\n\
  box-sizing: border-box;\n\
}\n\
.onera-inline-form input[type="email"]:focus {\n\
  border-color: #c4956a;\n\
}\n\
.onera-inline-form input[type="email"]::placeholder {\n\
  color: #b5b3ae;\n\
}\n\
.onera-inline-form button {\n\
  padding: 0.7rem 1.25rem;\n\
  min-height: 48px;\n\
  background: #c4956a;\n\
  color: #fff;\n\
  border: none;\n\
  border-radius: 10px;\n\
  font-size: 0.88rem;\n\
  font-weight: 500;\n\
  font-family: \'Inter\', sans-serif;\n\
  cursor: pointer;\n\
  white-space: nowrap;\n\
  transition: background 0.2s, transform 0.15s;\n\
}\n\
.onera-inline-form button:hover {\n\
  background: #b5854f;\n\
}\n\
.onera-inline-form button:active {\n\
  transform: scale(0.98);\n\
}\n\
.onera-inline-form button:disabled {\n\
  opacity: 0.6;\n\
  cursor: not-allowed;\n\
}\n\
.onera-inline-msg {\n\
  margin-top: 0.75rem;\n\
  font-size: 0.88rem;\n\
  text-align: center;\n\
}\n\
.onera-inline-msg.onera-success { color: #1a1917; font-weight: 500; }\n\
.onera-inline-msg.onera-error { color: #c0392b; }\n\
.onera-inline-privacy {\n\
  font-size: 0.72rem;\n\
  color: #8a8780;\n\
  margin-top: 0.6rem;\n\
}\n\
\n\
@media (max-width: 520px) {\n\
  .onera-popup h2 {\n\
    font-size: 1.25rem;\n\
  }\n\
  .onera-popup-cover {\n\
    width: 48px;\n\
    height: 62px;\n\
  }\n\
  .onera-popup-cover-icon {\n\
    font-size: 1.25rem;\n\
  }\n\
  .onera-inline-form {\n\
    flex-direction: column;\n\
  }\n\
  .onera-inline-form button {\n\
    width: 100%;\n\
  }\n\
}\n\
';
  document.head.appendChild(styles);

  // ============================================================
  // HELPERS
  // ============================================================
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Email typo detection — catches common domain misspellings
  var EMAIL_TYPO_MAP = {
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gnail.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'gmil.com': 'gmail.com',
    'hotmal.com': 'hotmail.com',
    'hotmial.com': 'hotmail.com',
    'hotmil.com': 'hotmail.com',
    'hotmail.co': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com',
    'outlook.co': 'outlook.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'yahoo.co': 'yahoo.com',
    'iclod.com': 'icloud.com',
    'icloud.co': 'icloud.com',
    'protonmai.com': 'protonmail.com'
  };

  function detectEmailTypo(email) {
    var parts = email.trim().toLowerCase().split('@');
    if (parts.length !== 2) return null;
    var domain = parts[1];
    if (EMAIL_TYPO_MAP[domain]) {
      return parts[0] + '@' + EMAIL_TYPO_MAP[domain];
    }
    return null;
  }

  function isSubscribed() {
    try { return localStorage.getItem('onera_subscribed') === 'true'; } catch(e) { return false; }
  }

  function markSubscribed() {
    try { localStorage.setItem('onera_subscribed', 'true'); } catch(e) {}
  }

  // 7-day cooldown after dismissal
  function isDismissedRecently() {
    try {
      var dismissed = localStorage.getItem('onera_popup_dismissed');
      if (!dismissed) return false;
      var dismissedTime = parseInt(dismissed, 10);
      var daysSince = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      return daysSince < DISMISS_COOLDOWN_DAYS;
    } catch(e) { return false; }
  }

  function markDismissed() {
    try {
      localStorage.setItem('onera_popup_dismissed', String(Date.now()));
      sessionStorage.setItem('onera_popup_shown_this_session', 'true');
    } catch(e) {}
  }

  // Once-per-session guard — popup shows max once per session
  function wasShownThisSession() {
    try { return sessionStorage.getItem('onera_popup_shown_this_session') === 'true'; } catch(e) { return false; }
  }

  async function submitEmail(email, source) {
    var res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        source: source,
        page_url: window.location.pathname
      })
    });
    if (!res.ok) {
      // 409 = duplicate, treat as success
      if (res.status === 409) return true;
      throw new Error('HTTP ' + res.status);
    }
    return true;
  }

  // ============================================================
  // FOCUS TRAP (accessibility)
  // ============================================================
  function trapFocus(container) {
    var focusableSelectors = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    var focusableEls = container.querySelectorAll(focusableSelectors);
    if (focusableEls.length === 0) return function() {};

    var firstEl = focusableEls[0];
    var lastEl = focusableEls[focusableEls.length - 1];

    function handler(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }

    container.addEventListener('keydown', handler);
    // Focus the first interactive element
    setTimeout(function() { firstEl.focus(); }, 50);

    // Return cleanup function
    return function() { container.removeEventListener('keydown', handler); };
  }

  // ============================================================
  // POPUP HTML BUILDERS
  // ============================================================
  var cleanupFocusTrap = null;
  var previousActiveElement = null;

  // Guide cover visual preview (shared between desktop/mobile)
  function guidePreviewHTML() {
    return (
      '<div class="onera-popup-preview">' +
        '<div class="onera-popup-cover">' +
          '<span class="onera-popup-cover-icon">\uD83C\uDF19</span>' +
          '<span class="onera-popup-cover-label">50 Symbols</span>' +
        '</div>' +
        '<div class="onera-popup-preview-text">' +
          '<div class="onera-popup-badge">Free PDF Guide</div>' +
        '</div>' +
      '</div>'
    );
  }

  function popupBodyHTML() {
    return (
      guidePreviewHTML() +
      '<h2>Decode 50 dream symbols in 5 minutes</h2>' +
      '<p class="onera-popup-sub">Most people get dream symbols wrong. This free guide reveals what 50 common dreams actually mean \u2014 backed by psychology, not guesswork.</p>' +
      '<div class="onera-popup-instant">\u26A1 Instant download \u2014 sent to your inbox in seconds</div>' +
      '<div class="onera-popup-body">' +
        '<form class="onera-popup-form">' +
          '<input type="email" placeholder="your@email.com" required autocomplete="email" aria-label="Email address">' +
          '<button type="submit">Send Me the Guide</button>' +
        '</form>' +
        '<button class="onera-popup-decline" type="button">No thanks, I\u2019ll figure it out myself</button>' +
        '<p class="onera-popup-privacy">No spam, ever. Unsubscribe anytime.</p>' +
      '</div>'
    );
  }

  function createPopup() {
    if (isMobile()) {
      return createMobileSheet();
    }
    return createDesktopPopup();
  }

  function createDesktopPopup() {
    var overlay = document.createElement('div');
    overlay.className = 'onera-popup-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Free Dream Symbol Guide signup');
    overlay.innerHTML =
      '<div class="onera-popup">' +
        '<button class="onera-popup-close" aria-label="Close popup">&times;</button>' +
        popupBodyHTML() +
      '</div>';
    document.body.appendChild(overlay);

    bindPopupHandlers(overlay, 'desktop');
    return overlay;
  }

  function createMobileSheet() {
    var sheet = document.createElement('div');
    sheet.className = 'onera-mobile-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Free Dream Symbol Guide signup');
    sheet.innerHTML =
      '<div class="onera-mobile-backdrop"></div>' +
      '<div class="onera-popup">' +
        '<div class="onera-mobile-handle"></div>' +
        '<button class="onera-popup-close" aria-label="Close popup">&times;</button>' +
        popupBodyHTML() +
      '</div>';
    document.body.appendChild(sheet);

    bindPopupHandlers(sheet, 'mobile');
    return sheet;
  }

  function bindPopupHandlers(container, mode) {
    var closeBtn = container.querySelector('.onera-popup-close');
    var declineBtn = container.querySelector('.onera-popup-decline');

    // Close handlers with tracking
    closeBtn.addEventListener('click', function() {
      trackEvent('close_click', { method: 'button' });
      dismissPopup(container);
    });

    // Decline handler with tracking
    declineBtn.addEventListener('click', function() {
      trackEvent('decline_click');
      dismissPopup(container);
    });

    // Click outside (overlay or backdrop)
    if (mode === 'desktop') {
      container.addEventListener('click', function(e) {
        if (e.target === container) {
          trackEvent('close_click', { method: 'overlay' });
          dismissPopup(container);
        }
      });
    } else {
      var backdrop = container.querySelector('.onera-mobile-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', function() {
          trackEvent('close_click', { method: 'backdrop' });
          dismissPopup(container);
        });
      }
    }

    // Escape key
    container._escHandler = function(e) {
      if (e.key === 'Escape') {
        trackEvent('close_click', { method: 'escape' });
        dismissPopup(container);
      }
    };
    document.addEventListener('keydown', container._escHandler);

    // Form interaction tracking + submit handler
    var form = container.querySelector('.onera-popup-form');
    var input = container.querySelector('input[type="email"]');
    var btn = container.querySelector('button[type="submit"]');
    var body = container.querySelector('.onera-popup-body');

    // Track form focus (intent signal) — once per popup
    var focusTracked = false;
    input.addEventListener('focus', function() {
      if (!focusTracked) {
        focusTracked = true;
        trackEvent('form_focus', { source: 'popup' });
      }
    });

    // Email typo detection on blur
    input.addEventListener('blur', function() {
      var suggestion = detectEmailTypo(input.value);
      var existingTypo = form.querySelector('.onera-typo-suggestion');
      if (existingTypo) existingTypo.remove();
      if (suggestion) {
        var typoEl = document.createElement('div');
        typoEl.className = 'onera-typo-suggestion';
        typoEl.textContent = 'Did you mean ' + suggestion + '?';
        typoEl.addEventListener('click', function() {
          input.value = suggestion;
          typoEl.remove();
          input.focus();
        });
        form.appendChild(typoEl);
      }
    });

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var email = input.value;
      trackEvent('submit_attempt', { source: 'popup' });

      if (!isValidEmail(email)) {
        showPopupMsg(body, 'Please enter a valid email address.', 'onera-error');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Sending...';
      submitEmail(email, 'popup').then(function() {
        markSubscribed();
        trackEvent('submit_success', { source: 'popup' });
        body.innerHTML =
          '<div class="onera-popup-msg onera-success">' +
            'You\u2019re in! \uD83C\uDF19' +
            '<span class="onera-success-sub">Here\u2019s your guide \u2014 <a href="/lead-magnet-50-symbols.html" target="_blank" style="color:#c4956a; text-decoration:underline; font-weight:600;">Download 50 Dream Symbols Guide</a></span>' +
          '</div>';
        setTimeout(function() { closePopupEl(container); }, 4000);
      }).catch(function() {
        showPopupMsg(body, 'Something went wrong. Try again.', 'onera-error');
        btn.disabled = false;
        btn.textContent = 'Send Me the Guide';
      });
    });
  }

  function showPopupMsg(container, text, cls) {
    var existing = container.querySelector('.onera-popup-msg');
    if (existing) existing.remove();
    var msg = document.createElement('div');
    msg.className = 'onera-popup-msg ' + cls;
    msg.textContent = text;
    container.appendChild(msg);
  }

  function showPopup(container) {
    markDismissed(); // Prevents re-trigger within same page/session
    previousActiveElement = document.activeElement;
    // Force reflow then show
    container.offsetHeight;
    container.classList.add('onera-visible');
    // Track view with trigger reason
    trackEvent('popup_view', { trigger: container._triggerReason || 'unknown', page_count: getPageCount() });
    // Set up focus trap
    var popupPanel = container.querySelector('.onera-popup');
    if (popupPanel) {
      cleanupFocusTrap = trapFocus(popupPanel);
    }
  }

  function dismissPopup(container) {
    markDismissed();
    closePopupEl(container);
  }

  function closePopupEl(container) {
    container.classList.remove('onera-visible');
    // Clean up
    if (cleanupFocusTrap) {
      cleanupFocusTrap();
      cleanupFocusTrap = null;
    }
    if (container._escHandler) {
      document.removeEventListener('keydown', container._escHandler);
      container._escHandler = null;
    }
    // Restore focus
    if (previousActiveElement) {
      previousActiveElement.focus();
      previousActiveElement = null;
    }
    setTimeout(function() {
      if (container.parentNode) container.parentNode.removeChild(container);
    }, 400);
  }

  // ============================================================
  // INLINE CAPTURE BOX
  // ============================================================

  // Extract the dream symbol from the page h1 title (e.g. "Snake Dream Meaning: ..." → "snake dreams")
  function extractSymbolFromTitle() {
    var h1 = document.querySelector('.article-title') || document.querySelector('h1');
    if (!h1) return 'dreams';
    var text = h1.textContent || '';
    // Match pattern like "Snake Dream Meaning" or "Teeth Falling Out Dream"
    var match = text.match(/^(.+?)\s+dream/i);
    if (match) return match[1].toLowerCase().trim() + ' dreams';
    return 'dreams';
  }

  // Build an inline capture box with custom badge text and subtitle
  function buildInlineBox(badgeText, subText, source) {
    var box = document.createElement('div');
    box.className = 'onera-inline-capture';
    box.innerHTML =
      '<div class="onera-inline-badge">\uD83D\uDCD6 ' + badgeText + '</div>' +
      '<p class="onera-inline-sub">' + subText + '</p>' +
      '<div class="onera-inline-body">' +
        '<form class="onera-inline-form">' +
          '<input type="email" placeholder="your@email.com" required autocomplete="email" aria-label="Email address">' +
          '<button type="submit">Send Me the Guide</button>' +
        '</form>' +
        '<p class="onera-inline-privacy">No spam, ever. Unsubscribe anytime.</p>' +
      '</div>';

    // If already subscribed, show success state
    if (isSubscribed()) {
      box.querySelector('.onera-inline-body').innerHTML =
        '<div class="onera-inline-msg onera-success">You\u2019re signed up! <a href="/lead-magnet-50-symbols.html" target="_blank" style="color:#c4956a; text-decoration:underline;">Download your guide here</a></div>';
    } else {
      bindInlineFormHandlers(box, source);
    }

    return box;
  }

  // Bind form submit + tracking handlers to an inline capture box
  function bindInlineFormHandlers(box, source) {
    var form = box.querySelector('.onera-inline-form');
    var input = box.querySelector('input[type="email"]');
    var btn = box.querySelector('button[type="submit"]');
    var body = box.querySelector('.onera-inline-body');

    // Track inline form focus
    var inlineFocusTracked = false;
    input.addEventListener('focus', function() {
      if (!inlineFocusTracked) {
        inlineFocusTracked = true;
        trackEvent('form_focus', { source: source });
      }
    });

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var email = input.value;
      trackEvent('submit_attempt', { source: source });

      if (!isValidEmail(email)) {
        showInlineMsg(body, 'Please enter a valid email address.', 'onera-error');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Sending...';
      submitEmail(email, source).then(function() {
        markSubscribed();
        trackEvent('submit_success', { source: source });
        body.innerHTML = '<div class="onera-inline-msg onera-success">You\u2019re in! <a href="/lead-magnet-50-symbols.html" target="_blank" style="color:#c4956a; text-decoration:underline;">Download your guide here</a></div>';
        // Update all other inline boxes on the page to show success state
        updateAllInlineBoxes();
        // Also hide popup if present
        var popup = document.querySelector('.onera-popup-overlay') || document.querySelector('.onera-mobile-sheet');
        if (popup) closePopupEl(popup);
      }).catch(function() {
        showInlineMsg(body, 'Something went wrong. Try again.', 'onera-error');
        btn.disabled = false;
        btn.textContent = 'Send Me the Guide';
      });
    });
  }

  // After a successful subscription, update all inline boxes on the page to success state
  function updateAllInlineBoxes() {
    var allBoxes = document.querySelectorAll('.onera-inline-capture');
    allBoxes.forEach(function(box) {
      var body = box.querySelector('.onera-inline-body');
      if (body && !body.querySelector('.onera-success')) {
        body.innerHTML = '<div class="onera-inline-msg onera-success">You\u2019re signed up! <a href="/lead-magnet-50-symbols.html" target="_blank" style="color:#c4956a; text-decoration:underline;">Download your guide here</a></div>';
      }
    });
  }

  // Insert inline capture boxes at strategic mid-article positions (after h2 headings)
  function createMidArticleBoxes() {
    var articleContent = document.querySelector('.article-content');
    if (!articleContent) return 0;

    // Find all h2 elements within the article content
    var h2s = articleContent.querySelectorAll('h2');
    if (h2s.length < 2) return 0; // Need at least 2 h2s to place mid-article boxes

    // Exclude h2s that come after .article-cta (e.g. FAQ sections at the bottom)
    var ctaEl = articleContent.querySelector('.article-cta');
    var eligibleH2s = [];
    for (var i = 0; i < h2s.length; i++) {
      // If there's a CTA, only include h2s that appear before it in DOM order
      if (ctaEl && (ctaEl.compareDocumentPosition(h2s[i]) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        continue; // This h2 is after the CTA, skip it
      }
      eligibleH2s.push(h2s[i]);
    }

    if (eligibleH2s.length < 2) return 0;

    var symbol = extractSymbolFromTitle();
    var inserted = 0;

    // Strategy: if 3+ eligible h2s, insert after 1st and middle h2. If 2, insert after 1st only.
    var insertAfterIndices = [];
    if (eligibleH2s.length >= 3) {
      insertAfterIndices.push(0); // After 1st h2
      var midIndex = Math.floor(eligibleH2s.length / 2);
      insertAfterIndices.push(midIndex); // After middle h2
    } else {
      // exactly 2 eligible h2s
      insertAfterIndices.push(0); // After 1st h2 only
    }

    // Position 1: after intro h2 — personalized with symbol name
    // Position 2: mid-article — generic "decode more" copy
    var copyVariants = [
      {
        badge: 'Free Dream Symbol Guide',
        sub: 'Reading about ' + symbol + '? Get our free guide with 50 symbols decoded.',
        source: 'inline_intro'
      },
      {
        badge: 'Free Dream Symbol Guide',
        sub: 'Want to decode more symbols? Get the full guide free.',
        source: 'inline_mid'
      }
    ];

    for (var j = 0; j < insertAfterIndices.length; j++) {
      var h2 = eligibleH2s[insertAfterIndices[j]];
      var copy = copyVariants[j];

      // Find the next sibling that is an element (skip past the content under this h2)
      // We want to insert after the h2's section — find the next h2 or block break
      var nextH2 = eligibleH2s[insertAfterIndices[j] + 1] || ctaEl;
      if (!nextH2) continue;

      // Don't insert if there's already an inline capture box right before this element
      if (nextH2.previousElementSibling && nextH2.previousElementSibling.classList.contains('onera-inline-capture')) continue;

      var box = buildInlineBox(copy.badge, copy.sub, copy.source);
      nextH2.parentNode.insertBefore(box, nextH2);
      inserted++;
    }

    return inserted;
  }

  function createInlineBox() {
    // First, insert mid-article boxes at strategic h2 break points
    var midBoxCount = createMidArticleBoxes();

    // Then, insert the original box before .article-cta elements
    // Cap total inline boxes at 3 per page
    var maxCtaBoxes = Math.max(0, 3 - midBoxCount);
    var ctaElements = document.querySelectorAll('.article-cta');
    var ctaInserted = 0;

    ctaElements.forEach(function(cta) {
      if (ctaInserted >= maxCtaBoxes) return;
      // Don't insert twice
      if (cta.previousElementSibling && cta.previousElementSibling.classList.contains('onera-inline-capture')) return;

      var box = buildInlineBox(
        'Free Dream Symbol Guide',
        'Get 50 dream symbols decoded \u2014 understand the hidden messages in your dreams.',
        'inline_cta'
      );
      cta.parentNode.insertBefore(box, cta);
      ctaInserted++;
    });
  }

  function showInlineMsg(container, text, cls) {
    var existing = container.querySelector('.onera-inline-msg');
    if (existing) existing.remove();
    var msg = document.createElement('div');
    msg.className = 'onera-inline-msg ' + cls;
    msg.textContent = text;
    container.appendChild(msg);
  }

  // ============================================================
  // EXIT INTENT DETECTION (Desktop only)
  // ============================================================
  function addExitIntentListener(callback) {
    if (isMobile()) return; // Exit intent only on desktop

    var triggered = false;
    function onMouseLeave(e) {
      // Only trigger when cursor leaves through the top of the viewport
      if (e.clientY <= 0 && !triggered) {
        triggered = true;
        document.removeEventListener('mouseleave', onMouseLeave);
        callback('exit_intent');
      }
    }
    // Delay adding exit intent by 5 seconds so we don't catch accidental moves
    setTimeout(function() {
      document.addEventListener('mouseleave', onMouseLeave);
    }, 5000);

    return function cleanup() {
      document.removeEventListener('mouseleave', onMouseLeave);
    };
  }

  // ============================================================
  // TRIGGER LOGIC (popup only)
  // ============================================================
  function initPopupTriggers() {
    // Don't show popup if: already subscribed, dismissed within cooldown, or already shown this session
    if (isSubscribed()) return;
    if (isDismissedRecently()) return;
    if (wasShownThisSession()) return;

    // Page count gate: track visits, only show popup after 2+ pages (research behavior signal)
    var pageCount = incrementPageCount();

    var container = createPopup();
    var triggered = false;

    function trigger(reason) {
      if (triggered) return;
      // On first page visit, only allow exit_intent trigger (less aggressive for new visitors)
      if (pageCount < MIN_PAGES_FOR_POPUP && reason !== 'exit_intent') return;
      triggered = true;
      container._triggerReason = reason || 'unknown';
      showPopup(container);
      // Clean up all listeners
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
      if (exitIntentCleanup) exitIntentCleanup();
    }

    // Timer trigger
    var timer = setTimeout(function() { trigger('timer'); }, POPUP_DELAY_MS);

    // Scroll trigger: 40% of page
    function onScroll() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0 && (scrollTop / docHeight) >= SCROLL_THRESHOLD) {
        trigger('scroll');
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    // Exit intent trigger (desktop only) — fires even on first page visit
    var exitIntentCleanup = addExitIntentListener(function(reason) { trigger(reason); });
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    createInlineBox();
    initPopupTriggers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
