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

// Screens not yet built (V3.2+) get an honest placeholder rather than a
// broken or missing page — every nav destination goes somewhere.
const SCREENS_BUILT = { home: true, journal: true };
const SCREEN_LABELS = { sabaq: 'Sabaq', sabaqDhor: 'Sabaq Dhor', dhor: 'Dhor', reflections: 'Reflections', plans: 'Plans', progress: 'Progress', settings: 'Settings' };

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
}

async function bootApp(){
  showAppShell();
  setupAuthBandAndDropdown();
  try{
    const profile = await apiGetProfile();
    currentUser = { name: profile.name || '', role: profile.role || 'student' };
    renderAuthBand();
    // NOTE: the V1.4 setup wizard (first-login onboarding) is not yet
    // reconciled against the V2/V3 schema — see CHANGELOG. For now we
    // land everyone straight on the journal regardless of setup_complete.
    // This is a known, flagged gap, not an oversight.
    showScreen('journal');
  } catch(e){
    showBanner("Couldn't load your profile: " + e.message);
    clearToken();
    showLoginScreen();
  }
}

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
    showLoginScreen();
  }
})();
