// ============================================================
// versionStamp.js — shows the running version on the login screens.
//
// WHY THIS EXISTS
// V3.68.0 shipped without its cache-busting bump, so browsers kept running
// V3.67.0's JavaScript while the source said 3.68.0. That cost a debugging
// session and produced a wrong diagnosis of a real bug report — there was
// no way to see which code was actually running.
//
// So this is DERIVED, never hardcoded. A hardcoded string would have said
// "3.68.0" throughout that failure, which is worse than showing nothing.
//   - the app version comes from the ?v= on a real <script> tag, i.e. what
//     this page actually asked the browser to load;
//   - the cache version comes from caches.keys(), i.e. what the service
//     worker is actually holding.
// Those two disagreeing IS the failure mode, so both are shown and a
// mismatch says so in words rather than leaving it to be spotted.
//
// Attached by QUERY to .login-card, not to a list of screen ids — there are
// four login screens and a hand-maintained list would drift, which is
// exactly how the boot crash in V3.73.1 happened.
// ============================================================

function appVersionFromScriptTag(){
  const tag = document.querySelector('script[src*="js/app.js"]');
  const m = tag && /[?&]v=([0-9][\w.-]*)/.exec(tag.getAttribute('src') || '');
  return m ? m[1] : null;
}

async function swCacheVersion(){
  try{
    if(!('caches' in window)) return null;
    const keys = await caches.keys();
    const hit = keys.find(k => /^hifzhelper-v/.test(k));
    return hit ? hit.replace(/^hifzhelper-v/, '') : null;
  } catch(e){ return null; }
}

async function renderVersionStamp(){
  const cards = document.querySelectorAll('.login-card');
  if(!cards.length) return;
  const app = appVersionFromScriptTag();
  const cache = await swCacheVersion();

  let text, stale = false;
  if(!app){
    text = 'version unknown';
  } else if(cache && cache !== app){
    // The exact V3.68.0 situation, named rather than left to be noticed.
    text = `v${app} — cached v${cache}, reload`;
    stale = true;
  } else {
    text = `v${app}`;
  }

  cards.forEach(card => {
    let el = card.querySelector('.version-stamp');
    if(!el){
      el = document.createElement('div');
      el.className = 'version-stamp';
      card.appendChild(el);
    }
    el.textContent = text;
    el.classList.toggle('stale', stale);
  });
}
