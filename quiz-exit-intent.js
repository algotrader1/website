/**
 * ONERA Quiz — Exit Intent Email Capture
 * Shows a modal when users try to leave after step 10+
 * Saves email to Supabase email_subscribers table
 * Fires Meta Pixel QuizAbandonment event
 *
 * Usage: Include this script after quiz JS. Configure via:
 * window.ONERA_EXIT_INTENT = {
 *   supabaseUrl: 'https://your-project.supabase.co',
 *   supabaseAnonKey: 'your-anon-key',
 *   minStep: 10  // minimum step before showing modal
 * };
 */
(function() {
  'use strict';

  const CONFIG = Object.assign({
    supabaseUrl: 'https://cxtoofvckqllsasriczb.supabase.co',
    supabaseAnonKey: '',
    minStep: 10
  }, window.ONERA_EXIT_INTENT || {});

  let exitShown = false;

  function getQuizStep() {
    try {
      const saved = sessionStorage.getItem('onera_quiz');
      if (saved) return JSON.parse(saved).step || 0;
    } catch(e) {}
    return typeof currentStep !== 'undefined' ? currentStep : 0;
  }

  function getQuizGender() {
    try {
      const saved = sessionStorage.getItem('onera_quiz');
      if (saved) return JSON.parse(saved).gender || '';
    } catch(e) {}
    return typeof selectedGender !== 'undefined' ? selectedGender : '';
  }

  function createModal() {
    const overlay = document.createElement('div');
    overlay.id = 'oneraExitOverlay';
    overlay.innerHTML = `
      <div id="oneraExitCard">
        <button id="oneraExitClose" aria-label="Close">&times;</button>
        <div id="oneraExitContent">
          <div style="font-size:32px;margin-bottom:8px;">&#127769;</div>
          <h2 style="font-family:'Instrument Serif',Georgia,serif;font-size:22px;font-weight:400;line-height:1.35;margin-bottom:8px;color:#ede8e0;">
            Your dream profile is almost ready.
          </h2>
          <p style="font-size:13px;color:#a89d8f;line-height:1.6;margin-bottom:20px;">
            Enter your email and we'll save your progress — so you can see your results anytime.
          </p>
          <form id="oneraExitForm" style="display:flex;flex-direction:column;gap:10px;">
            <input type="email" id="oneraExitEmail" placeholder="your@email.com" required
              style="background:#1e1a28;border:1px solid rgba(196,149,106,0.3);border-radius:10px;padding:14px 16px;
              font-size:14px;color:#ede8e0;outline:none;width:100%;font-family:inherit;"
            />
            <button type="submit" id="oneraExitCTA"
              style="background:#c4956a;color:#0a0a14;border:none;padding:14px;border-radius:10px;
              font-size:14px;font-weight:600;cursor:pointer;transition:all 0.3s;font-family:inherit;">
              Save My Progress
            </button>
          </form>
          <p style="font-size:11px;color:#6b5f52;margin-top:10px;">We'll never spam you. Just your results.</p>
        </div>
        <div id="oneraExitSuccess" style="display:none;text-align:center;padding:20px 0;">
          <div style="font-size:36px;margin-bottom:12px;">&#10003;</div>
          <p style="font-size:15px;color:#ede8e0;">Saved. We'll send your results.</p>
        </div>
      </div>
    `;

    // Styles
    const style = document.createElement('style');
    style.textContent = `
      #oneraExitOverlay {
        position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);
        z-index:9999;display:flex;align-items:center;justify-content:center;
        opacity:0;transition:opacity 0.3s;padding:20px;
      }
      #oneraExitOverlay.show { opacity:1; }
      #oneraExitCard {
        background:#16131e;border:1px solid rgba(196,149,106,0.2);
        border-radius:16px;padding:28px 24px;max-width:360px;width:100%;
        position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.5);
        text-align:center;
      }
      #oneraExitClose {
        position:absolute;top:12px;right:14px;background:none;border:none;
        color:#6b5f52;font-size:22px;cursor:pointer;padding:4px;
        min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;
      }
      #oneraExitEmail:focus { border-color:#c4956a; }
      #oneraExitCTA:hover { background:#d4a87a; }
      #oneraExitCTA:disabled { opacity:0.6;cursor:not-allowed; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    // Events
    document.getElementById('oneraExitClose').onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

    document.getElementById('oneraExitForm').onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('oneraExitEmail').value.trim();
      if (!email) return;

      const btn = document.getElementById('oneraExitCTA');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        // Save to Supabase
        if (CONFIG.supabaseUrl && CONFIG.supabaseAnonKey) {
          await fetch(CONFIG.supabaseUrl + '/rest/v1/email_subscribers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': CONFIG.supabaseAnonKey,
              'Authorization': 'Bearer ' + CONFIG.supabaseAnonKey,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              email: email,
              source: 'quiz_exit_intent',
              quiz_step: getQuizStep(),
              gender: getQuizGender(),
              cpp_id: typeof currentCPP !== 'undefined' ? currentCPP.id : null,
              created_at: new Date().toISOString()
            })
          });
        }

        // Fire Meta Pixel Lead event
        if (typeof fbq !== 'undefined') {
          fbq('track', 'Lead', { content_name: 'exit_intent_email', value: 0, currency: 'USD' });
        }

        // Show success
        document.getElementById('oneraExitContent').style.display = 'none';
        document.getElementById('oneraExitSuccess').style.display = 'block';
        setTimeout(closeModal, 2000);
      } catch(err) {
        btn.disabled = false;
        btn.textContent = 'Save My Progress';
      }
    };

    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  function closeModal() {
    const overlay = document.getElementById('oneraExitOverlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
    }
  }

  function showExitModal() {
    if (exitShown) return;
    if (sessionStorage.getItem('onera_exit_shown')) return;
    if (getQuizStep() < CONFIG.minStep) return;

    exitShown = true;
    sessionStorage.setItem('onera_exit_shown', '1');

    // Fire abandonment pixel
    if (typeof fbq !== 'undefined') {
      fbq('trackCustom', 'QuizAbandonment', { step: getQuizStep() });
    }

    createModal();
  }

  // Desktop: mouse leaves viewport top
  document.addEventListener('mouseout', (e) => {
    if (e.clientY <= 0 && !exitShown) showExitModal();
  });

  // Mobile: back button / history popstate
  window.addEventListener('popstate', () => {
    if (!exitShown) showExitModal();
  });

  // Mobile: rapid scroll-up near top of page
  let lastScrollY = window.scrollY;
  let lastScrollTime = Date.now();
  window.addEventListener('scroll', () => {
    const now = Date.now();
    const dy = lastScrollY - window.scrollY;
    const dt = now - lastScrollTime;
    if (dy > 120 && dt < 300 && window.scrollY < 100 && !exitShown) {
      showExitModal();
    }
    lastScrollY = window.scrollY;
    lastScrollTime = now;
  }, { passive: true });

})();
