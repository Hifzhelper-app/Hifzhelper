// ============================================================
// Hifzhelper — auth: login screen, top auth band, dropdown menu
// ============================================================

let currentUser = { name: '', role: 'student' };

// Nav destinations — the same set drives both the dropdown menu and the
// Home page tiles (per the "similar icons/tiles" decision). Screens not
// built yet show a simple "coming soon" placeholder rather than being
// left broken or absent — see showScreen() in app.js.
const NAV_ITEMS = [
  { id: 'journal', label: 'Journal', icon: 'journal' },
  { id: 'sabaq', label: 'Sabaq', icon: 'sabaq' },
  { id: 'sabaqDhor', label: 'Sabaq Dhor', icon: 'sabaqDhor' },
  { id: 'dhor', label: 'Dhor', icon: 'dhor' },
  { id: 'reflections', label: 'Reflections', icon: 'reflections' },
  { id: 'progress', label: 'Progress', icon: 'progress' },
  { id: 'settings', label: 'Settings', icon: 'settings' }
];
// Admin-only destination — appended conditionally, not shown to students/
// teachers even though the backend already 403s them regardless (this is
// just about not showing a button that would only ever fail for them).
const ADMIN_NAV_ITEM = { id: 'admin', label: 'Admin', icon: 'admin' };

function visibleNavItems(){
  return currentUser.role === 'admin' ? NAV_ITEMS.concat([ADMIN_NAV_ITEM]) : NAV_ITEMS;
}

function renderNavItemsInto(containerId, extraItemsHtml){
  const el = document.getElementById(containerId);
  el.innerHTML = visibleNavItems().map(item =>
    `<button class="nav-icon-item" data-nav="${item.id}">${iconHtml(item.icon)}<span>${item.label}</span></button>`
  ).join('') + (extraItemsHtml || '');
  el.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeAuthDropdown();
      showScreen(btn.dataset.nav);
    });
  });
}

function renderAuthBand(){
  document.querySelector('#authBand .user-name').textContent = currentUser.name || 'Hifzhelper';
}

function toggleAuthDropdown(){
  const dd = document.getElementById('authDropdown');
  const toggle = document.getElementById('authBandToggle');
  const opening = !dd.classList.contains('open');
  dd.classList.toggle('open', opening);
  toggle.classList.toggle('open', opening);
}
function closeAuthDropdown(){
  document.getElementById('authDropdown').classList.remove('open');
  document.getElementById('authBandToggle').classList.remove('open');
}

function setupAuthBandAndDropdown(){
  renderNavItemsInto('authDropdownNav',
    '<div class="dropdown-divider"></div>' +
    `<button class="nav-icon-item" id="refreshBtn">${iconHtml('refresh')}<span>Refresh</span></button>` +
    `<button class="nav-icon-item" id="logoutBtn">${iconHtml('logout')}<span>Log out</span></button>`
  );
  document.getElementById('authBandToggle').innerHTML = iconHtml('menu');
  document.getElementById('authBandToggle').addEventListener('click', toggleAuthDropdown);
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    location.reload();
  });
  document.getElementById('refreshBtn').addEventListener('click', () => {
    closeAuthDropdown();
    location.reload();
  });
}

// ---------- generic 4-digit PIN box group ----------
// Auto-advances focus as each digit fills; backspace on an empty box moves
// focus back to the previous one; calls onComplete(pin) the instant the
// last digit lands — every PIN entry point auto-submits now, so no screen
// needs a Sign-in button (V3.4 items 12/13).
function setupPinGroup(ids, onComplete){
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
      el.value = el.value.replace(/[^0-9]/g, '').slice(0,1);
      if(el.value && i < ids.length - 1){
        document.getElementById(ids[i+1]).focus();
      } else if(el.value && i === ids.length - 1){
        onComplete(readPinGroup(ids));
      }
    });
    el.addEventListener('keydown', (e) => {
      if(e.key === 'Backspace' && !el.value && i > 0) document.getElementById(ids[i-1]).focus();
    });
  });
}
function readPinGroup(ids){ return ids.map(id => document.getElementById(id).value).join(''); }
function clearPinGroup(ids){
  ids.forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById(ids[0]).focus();
}

const FALLBACK_PIN_IDS = ['fb_pin_1','fb_pin_2','fb_pin_3','fb_pin_4'];
const PERSONAL_PIN_IDS = ['p_pin_1','p_pin_2','p_pin_3','p_pin_4'];
const CREATE_PIN_IDS = ['cr_pin_1','cr_pin_2','cr_pin_3','cr_pin_4'];
const CONFIRM_PIN_IDS = ['cf_pin_1','cf_pin_2','cf_pin_3','cf_pin_4'];

// ---------- screen switching ----------
const ALL_LOGIN_SCREENS = ['loginScreenFallback','loginScreenPersonal','createPinScreen','registerScreen','registeredScreen'];
function hideAllLoginScreens(){
  ALL_LOGIN_SCREENS.forEach(id => { document.getElementById(id).classList.add('hidden'); });
}
function showAppShell(){
  hideAllLoginScreens();
  document.getElementById('appShell').style.display = 'flex';
}

// The unique ID selected for this login, once its lookup succeeds. A personal
// URL supplies it first; when a home-screen launch starts at / or /index.html,
// the remembered device ID supplies it instead. Both routes use the same PIN-
// only/create-PIN screens and never need their own ID input.
let activeLoginId = null;

// Decides which login screen to show. An explicit unique-ID URL wins over a
// remembered device ID. No screen is shown until that lookup resolves
// (CONVENTIONS.md #8 — never render state-dependent UI ahead of the async
// fetch it depends on); a missing/unknown/inactive ID still falls back to the
// plain ID+PIN screen.
async function routeToLoginScreen(){
  const pathId = getPathLoginId();
  const candidateId = pathId || getRememberedLoginId();
  if(candidateId){
    try{
      const info = await apiLookup(candidateId);
      activeLoginId = candidateId;
      // Canonicalize root/index launches after a successful remembered-ID
      // lookup. This keeps refresh/logout on the student's personal path too.
      if(!pathId) replaceUrlWithLoginId(candidateId);
      if(info.hasPin) showLoginScreenPersonal(info.name);
      else showCreatePinScreen(info.name);
      return;
    } catch(e){
      // Keep the fallback usable for an inactive/unknown remembered account
      // or a temporary lookup failure. Pre-filling the candidate below means
      // the student still only needs to type it again if they change account.
    }
  }
  showLoginScreenFallback(candidateId);
}

function showLoginScreenFallback(prefillId){
  hideAllLoginScreens();
  document.getElementById('fallback_login_id').value = prefillId || '';
  document.getElementById('loginScreenFallback').classList.remove('hidden');
}
function showLoginScreenPersonal(name){
  hideAllLoginScreens();
  document.getElementById('personalGreeting').textContent = `Ahlan wa Sahlan, ${name}`;
  document.getElementById('loginScreenPersonal').classList.remove('hidden');
  clearPinGroup(PERSONAL_PIN_IDS);
}
function showCreatePinScreen(name){
  hideAllLoginScreens();
  document.getElementById('createPinGreeting').textContent = `Ahlan wa Sahlan, ${name}`;
  document.getElementById('createPinScreen').classList.remove('hidden');
  document.getElementById('createPinReminderMessage').textContent = REGISTRATION_CONFIRMATION_TEXT;
  document.getElementById('createPinUrl').value = window.location.origin + '/' + activeLoginId;
  document.getElementById('confirmPinWrap').classList.add('hidden');
  clearPinGroup(CONFIRM_PIN_IDS);
  clearPinGroup(CREATE_PIN_IDS);
}
function showRegisterScreen(){
  hideAllLoginScreens();
  cancelRegisterMatch();
  document.getElementById('register_name').value = '';
  document.getElementById('register_whatsapp').value = '';
  document.getElementById('registerError').textContent = '';
  document.getElementById('registerScreen').classList.remove('hidden');
}

document.getElementById('showRegisterBtn').addEventListener('click', showRegisterScreen);
document.getElementById('showLoginBtn').addEventListener('click', routeToLoginScreen);
function switchLoginAccount(){
  clearToken();
  forgetRememberedLoginId();
  window.location.replace('/');
}
document.getElementById('personalSwitchAccountBtn').addEventListener('click', switchLoginAccount);
document.getElementById('createPinSwitchAccountBtn').addEventListener('click', switchLoginAccount);

// ---------- fallback screen: ID + PIN, auto-submits on the 4th PIN digit ----------
setupPinGroup(FALLBACK_PIN_IDS, async (pin) => {
  const id = document.getElementById('fallback_login_id').value.trim();
  const errEl = document.getElementById('fallbackLoginError');
  errEl.textContent = '';
  if(!id){
    errEl.textContent = 'Enter your ID and a 4-digit PIN.';
    clearPinGroup(FALLBACK_PIN_IDS);
    return;
  }
  try{
    const loginResult = await apiLogin(id, pin);
    replaceUrlWithLoginId(id);
    await bootApp();
    // Unlike the URL-based flow, there's no personal link already on
    // screen to save here, so the save-this-page reminder still earns
    // its place on first login through the fallback screen.
    if(loginResult.firstLogin) showFirstLoginMessage();
  } catch(e){
    errEl.textContent = e.message;
    clearPinGroup(FALLBACK_PIN_IDS);
  }
});

// ---------- personalized screen: PIN only, ID known from URL or this device ----------
setupPinGroup(PERSONAL_PIN_IDS, async (pin) => {
  const errEl = document.getElementById('personalLoginError');
  errEl.textContent = '';
  try{
    await apiLogin(activeLoginId, pin);
    await bootApp();
  } catch(e){
    errEl.textContent = e.message;
    clearPinGroup(PERSONAL_PIN_IDS);
  }
});

// ---------- create-PIN screen: entered twice to confirm, then logs in ----------
setupPinGroup(CREATE_PIN_IDS, () => {
  document.getElementById('confirmPinWrap').classList.remove('hidden');
  document.getElementById(CONFIRM_PIN_IDS[0]).focus();
});
setupPinGroup(CONFIRM_PIN_IDS, async (confirmPin) => {
  const errEl = document.getElementById('createPinError');
  errEl.textContent = '';
  const firstPin = readPinGroup(CREATE_PIN_IDS);
  if(firstPin !== confirmPin){
    errEl.textContent = "PINs didn't match — try again.";
    document.getElementById('confirmPinWrap').classList.add('hidden');
    clearPinGroup(CONFIRM_PIN_IDS);
    clearPinGroup(CREATE_PIN_IDS);
    return;
  }
  try{
    await apiLogin(activeLoginId, confirmPin); // no pin_hash yet server-side, so this sets it
    await bootApp();
  } catch(e){
    errEl.textContent = e.message;
    document.getElementById('confirmPinWrap').classList.add('hidden');
    clearPinGroup(CONFIRM_PIN_IDS);
    clearPinGroup(CREATE_PIN_IDS);
  }
});

// ---------- registration ----------
// The form fields stay visible and editable the whole time (V3.4.2) —
// Continue always re-submits with whatever is CURRENTLY in the fields, so
// editing them first (to fix a typo, or so it no longer collides with
// anything) and then hitting Continue naturally becomes an ordinary
// registration instead of a forced duplicate. V3.4.3: Continue reads the
// match info back from that SAME force:true call rather than trusting any
// earlier-stored flag, so it can never act on a stale match.
document.getElementById('registerBtn').addEventListener('click', attemptRegister);
document.getElementById('registerContinueBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('registerError');
  errEl.textContent = '';
  const name = document.getElementById('register_name').value.trim();
  const whatsapp = document.getElementById('register_whatsapp').value.trim();
  try{
    const result = await apiRegister(name, whatsapp || null, true);
    if(result.matched){
      if(result.matchedActive){
        // Deactivating the OLD journal isn't self-service here — the
        // "match" is just a self-reported name+WhatsApp claim, not
        // verified identity, so it routes through email for a human to
        // actually check (V3.4.1).
        if(confirm('Would you also like to request that the old journal be deactivated? This sends an email — it will not happen automatically.')){
          const body = encodeURIComponent(`Name: ${name}\nWhatsApp: ${whatsapp}\n\nA new journal was just created for this name/WhatsApp — please deactivate the existing one.`);
          window.location.href = `mailto:hifzhelper.app@gmail.com?subject=Deactivate%20old%20journal&body=${body}`;
        }
      } else {
        // The matched journal is already inactive — deactivating makes no
        // sense; offer to request reactivation instead (V3.4.3 item 6).
        if(confirm("The existing journal with these details is currently inactive. Would you like to request that it's made active again instead?")){
          const body = encodeURIComponent(`Name: ${name}\nWhatsApp: ${whatsapp}\n\nA new journal was just created for this name/WhatsApp, but an existing INACTIVE journal with the same details was found — please consider reactivating it (and resetting its PIN if needed).`);
          window.location.href = `mailto:hifzhelper.app@gmail.com?subject=Reactivate%20existing%20journal&body=${body}`;
        }
      }
    }
    showRegisteredScreen(result.id, result.name);
  } catch(e){
    errEl.textContent = "Couldn't register: " + e.message;
  }
});
document.getElementById('registerCancelBtn').addEventListener('click', cancelRegisterMatch);
document.getElementById('registerResetPinBtn').addEventListener('click', () => {
  const name = document.getElementById('register_name').value.trim();
  const whatsapp = document.getElementById('register_whatsapp').value.trim();
  const body = encodeURIComponent(`Name: ${name}\nWhatsApp: ${whatsapp}`);
  window.location.href = `mailto:hifzhelper.app@gmail.com?subject=Reset%20PIN&body=${body}`;
});

async function attemptRegister(){
  const errEl = document.getElementById('registerError');
  errEl.textContent = '';
  const name = document.getElementById('register_name').value.trim();
  const whatsapp = document.getElementById('register_whatsapp').value.trim();
  if(!name){ errEl.textContent = 'Enter your name.'; return; }

  try{
    const result = await apiRegister(name, whatsapp || null, false);
    if(result.matched){
      // V3.4.3 item 6: the duplicate-check now also searches inactive
      // students, so this can no longer assume the match is active.
      document.getElementById('registerMatchHint').textContent = result.matchedActive
        ? 'We found an existing student with this name and WhatsApp number. What would you like to do?'
        : 'We found an existing but INACTIVE journal with this name and WhatsApp number. What would you like to do?';
      document.getElementById('registerMatchHint').classList.remove('hidden');
      document.getElementById('registerNormalActions').classList.add('hidden');
      document.getElementById('registerMatchActions').classList.remove('hidden');
    } else {
      showRegisteredScreen(result.id, result.name);
    }
  } catch(e){
    errEl.textContent = "Couldn't register: " + e.message;
  }
}

function cancelRegisterMatch(){
  document.getElementById('registerMatchHint').classList.add('hidden');
  document.getElementById('registerMatchActions').classList.add('hidden');
  document.getElementById('registerNormalActions').classList.remove('hidden');
}

// Exact confirmed wording (see chat) — shown verbatim, never reworded.
const REGISTRATION_CONFIRMATION_TEXT =
`This is your personal URL to access your Hifzhelper Journal. Do not share the link.
1. For the best experience on phones install as an app on your phone.
2. CREATE an easy to remember pin
3. LOGIN with your pin
Please contact hifzhelper.app@gmail.com for any queries or if you need to reset your PIN
May Allah bless you on this journey and make your path to Jannah easy
Wassalam`;

function showRegisteredScreen(id, name){
  hideAllLoginScreens();
  const url = window.location.origin + '/' + id;
  document.getElementById('registeredMessage').textContent = REGISTRATION_CONFIRMATION_TEXT;
  document.getElementById('registeredUrl').value = url;
  document.getElementById('registeredScreen').classList.remove('hidden');
  document.getElementById('registeredContinueBtn').onclick = async () => {
    try{ await navigator.clipboard.writeText(url); } catch(e){ /* falls through to navigating regardless */ }
    window.location.href = url;
  };
}

// Generic copy-to-clipboard icon button: shared by the Registered screen
// and the create-PIN screen's URL reminder (V3.4.2 item 10) — one place
// to change the copy/check-icon-swap behavior rather than duplicating it.
function wireCopyButton(buttonId, inputId){
  const btn = document.getElementById(buttonId);
  btn.innerHTML = iconHtml('copy');
  btn.addEventListener('click', async () => {
    const input = document.getElementById(inputId);
    try{
      await navigator.clipboard.writeText(input.value);
    } catch(e){
      input.select();
      document.execCommand('copy');
    }
    btn.innerHTML = iconHtml('check');
    btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML = iconHtml('copy'); btn.classList.remove('copied'); }, 1500);
  });
}
wireCopyButton('copyRegisteredUrlBtn', 'registeredUrl');
wireCopyButton('copyCreatePinUrlBtn', 'createPinUrl');

// First-login: a one-time message to save the URL / add to home screen —
// only shown via the fallback ID+PIN screen now (see its handler above).
// The URL-based flow doesn't need this: the registration-confirmation
// screen already covered saving the link, and by definition they're
// already sitting on their personal URL by the time they reach it.
function showFirstLoginMessage(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-card">
    <h2>You're all set!</h2>
    <p class="form-hint">Save this page's URL somewhere safe, or add it to your home screen now — that's how you'll come back to Hifzhelper next time.</p>
    <div class="modal-actions"><button class="primary" id="firstLoginOkBtn">Got it</button></div>
  </div>`;
  document.body.appendChild(overlay);
  document.getElementById('firstLoginOkBtn').addEventListener('click', () => overlay.remove());
}
