// ============================================================
// Hifzhelper — app bootstrap and screen routing
// ============================================================

// A visible way to surface errors — never a silent failure.
function showBanner(message){
  const el = document.getElementById('errorBanner');
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// A brief, friendly greeting shown once each time the app boots (login or
// returning with a valid token) — the "Welcome, [Name]" finding.
function showWelcome(name){
  const el = document.getElementById('welcomeBanner');
  el.textContent = `Welcome, ${name}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

// Screens not yet built (V3.2+) get an honest placeholder rather than a
// broken or missing page — every nav destination goes somewhere.
// V3.6.1: 'sabaq'/'sabaqDhor'/'dhor' are no longer separate screens — all
// three now open 'logDetail' (the unified 4-card day-log view); the old
// ids are still used as the `param` telling it which card to open on.
// V3.7.0: 'settings' is now built (Setup screen, profile section only).
const SCREENS_BUILT = { home: true, journal: true, logDetail: true, admin: true, settings: true };
const SCREEN_LABELS = { reflections: 'Reflections', plans: 'Plans', progress: 'Progress' };

async function showScreen(id, param){
  document.querySelectorAll('#appContent > .screen').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById('screen-' + id) || document.getElementById('screen-placeholder');

  if(!SCREENS_BUILT[id]){
    document.getElementById('placeholderLabel').textContent = SCREEN_LABELS[id] || id;
    target.classList.remove('hidden');
    return;
  }
  target.classList.remove('hidden');
  if(id === 'home') renderHomeScreen();
  if(id === 'journal'){ await renderJournalScreen(); fixJournalTopPaint(); }
  if(id === 'logDetail') await renderLogDetailScreen(param);
  if(id === 'admin') await renderAdminScreen();
  if(id === 'settings') await renderSettingsScreen();
}

// Safari-only "journal invisible until scroll" bug: the V3.4.3 CSS-only
// attempt (translateZ(0) on #appContent) didn't fix it. Rather than add a
// blind fixed-height margin (which would double up with the already-
// correct flex layout once painted, creating a visible gap on every
// device), this measures the ACTUAL gap between the auth band's bottom
// edge and wherever the journal content is really rendering, and only
// corrects it if one truly exists. The read+write of layout values here
// is also what forces Safari through a synchronous layout+paint pass —
// that's what actually resolves the invisible-until-scroll symptom, the
// margin correction itself is closer to a side effect / safety net.
// Also publishes --auth-band-height, which the sticky table headers
// below use for their own offset, since the band's real height varies
// (e.g. the iOS safe-area-inset padding) and a hardcoded value would be
// wrong on some devices.
function fixJournalTopPaint(){
  requestAnimationFrame(() => {
    const band = document.getElementById('authBand');
    if(!band) return;
    document.documentElement.style.setProperty('--auth-band-height', band.getBoundingClientRect().height + 'px');
    const target = document.getElementById('screen-journal');
    if(!target) return;
    const gap = band.getBoundingClientRect().bottom - target.getBoundingClientRect().top;
    target.style.marginTop = gap > 0 ? gap + 'px' : '';
  });
}

async function bootApp(){
  showAppShell();
  try{
    const profile = await apiGetProfile();
    // V3.4.2 item 2: a valid token alone isn't enough — it must also
    // belong to the account the current URL actually points to. Without
    // this, editing the unique ID in the address bar and pressing enter
    // (a fresh page load, not a back/forward history traversal, so the
    // back-guard's popstate listener never even sees it) silently kept
    // showing whichever account's token was already stored, ignoring the
    // URL entirely.
    const urlId = decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, ''));
    if(urlId && profile.id && urlId !== profile.id){
      clearToken();
      routeToLoginScreen();
      return;
    }
    currentUser = { name: profile.name || '', role: profile.role || 'student' };
    setupAuthBandAndDropdown(); // must run AFTER currentUser.role is known — it renders the nav based on it
    renderAuthBand();
    showWelcome(currentUser.name || 'back');
    armBackGuard();
    // V3.7.0: a new user (setup_complete still 0) lands on Setup first —
    // returning users go straight to the journal as before. Setup itself
    // is also reachable any time afterward via the "Settings" nav item.
    showScreen(profile.setup_complete ? 'journal' : 'settings');
  } catch(e){
    showBanner("Couldn't load your profile: " + e.message);
    clearToken();
    routeToLoginScreen();
  }
}

// Back/forward guard (V3.4.1, refined in V3.4.2 to take TWO presses): while
// authenticated, history navigation (back or forward — a popstate event
// doesn't distinguish which) logs out and drops back to a fresh login
// screen instead of silently continuing whatever session happens to still
// be active — this is what stops one account's session from carrying over
// onto a different account's URL via the browser's own back/forward
// buttons. The first press only warns (and quietly re-arms the guard); a
// second press right after is what actually logs out. Meant to catch an
// accidental press, not trap anyone — it still does something on the
// first press (a visible warning) rather than silently absorbing it.
let backGuardWarned = false;
function armBackGuard(){
  backGuardWarned = false;
  history.pushState({ hifzhelperGuard: true }, '', location.href);
}
window.addEventListener('popstate', () => {
  if(!getToken()) return;
  if(!backGuardWarned){
    backGuardWarned = true;
    showBanner('Press back again to log out.');
    history.pushState({ hifzhelperGuard: true }, '', location.href);
  } else {
    clearToken();
    routeToLoginScreen();
  }
});

(function init(){
  document.getElementById('th_sabaq').innerHTML = iconHtml('sabaq') + '<span>Sabaq</span>';
  document.getElementById('th_sabaqDhor').innerHTML = iconHtml('sabaqDhor') + '<span>Sabaq Dhor</span>';
  document.getElementById('th_dhor').innerHTML = iconHtml('dhor') + '<span>Dhor</span>';
  document.querySelectorAll('.journal-header-row button[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => showScreen('logDetail', btn.dataset.nav));
  });

  if(getToken()){
    bootApp();
  } else {
    routeToLoginScreen();
  }
})();
