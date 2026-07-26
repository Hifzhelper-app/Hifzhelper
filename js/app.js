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
const SCREENS_BUILT = { home: true, journal: true, sabaq: true, sabaqDhor: true, dhor: true, admin: true };
const SCREEN_LABELS = { reflections: 'Reflections', plans: 'Plans', progress: 'Progress', settings: 'Settings' };

async function showScreen(id){
  document.querySelectorAll('#appContent > .screen').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById('screen-' + id) || document.getElementById('screen-placeholder');

  if(!SCREENS_BUILT[id]){
    document.getElementById('placeholderLabel').textContent = SCREEN_LABELS[id] || id;
    target.classList.remove('hidden');
    return;
  }
  target.classList.remove('hidden');
  if(id === 'home') renderHomeScreen();
  if(id === 'journal') await renderJournalScreen();
  if(id === 'sabaq') await renderSabaqScreen();
  if(id === 'sabaqDhor') await renderSabaqDhorScreen();
  if(id === 'dhor') await renderDhorScreen();
  if(id === 'admin') await renderAdminScreen();
}

async function bootApp(){
  showAppShell();
  try{
    const profile = await apiGetProfile();
    currentUser = { name: profile.name || '', role: profile.role || 'student' };
    setupAuthBandAndDropdown(); // must run AFTER currentUser.role is known — it renders the nav based on it
    renderAuthBand();
    showWelcome(currentUser.name || 'back');
    armBackGuard();
    // NOTE: the V1.4 setup wizard (first-login onboarding) is not yet
    // reconciled against the V2/V3 schema — see CHANGELOG. For now we
    // land everyone straight on the journal regardless of setup_complete.
    // This is a known, flagged gap, not an oversight.
    showScreen('journal');
  } catch(e){
    showBanner("Couldn't load your profile: " + e.message);
    clearToken();
    routeToLoginScreen();
  }
}

// Back/forward guard (V3.4.1): while authenticated, ANY history navigation
// (back or forward — the browser doesn't distinguish which in a popstate
// event) logs out and drops back to a fresh login screen rather than
// silently continuing whatever session happens to still be active. This is
// what stops one account's session from carrying over onto a different
// account's URL via the browser's own back/forward buttons. Meant to catch
// an accidental press, not trap anyone — it still does something (logs
// out) rather than blocking navigation outright.
function armBackGuard(){
  history.pushState({ hifzhelperGuard: true }, '', location.href);
}
window.addEventListener('popstate', () => {
  if(getToken()){
    clearToken();
    routeToLoginScreen();
  }
});

(function init(){
  document.getElementById('th_sabaq').innerHTML = iconHtml('sabaq') + '<span>Sabaq</span>';
  document.getElementById('th_sabaqDhor').innerHTML = iconHtml('sabaqDhor') + '<span>Sabaq Dhor</span>';
  document.getElementById('th_dhor').innerHTML = iconHtml('dhor') + '<span>Dhor</span>';
  document.querySelectorAll('.journal-table th button[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.nav));
  });

  if(getToken()){
    bootApp();
  } else {
    routeToLoginScreen();
  }
})();
