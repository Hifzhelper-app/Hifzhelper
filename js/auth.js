/* Hifzhelper build 4.2.6 | js/auth.js */
// ============================================================
// Hifzhelper — auth: login screen, top auth band, dropdown menu
// ============================================================

let currentUser = { name: '', role: 'student', trackHaidh: false };

// Nav destinations — the same set drives both the dropdown menu and the
// Home page tiles (per the "similar icons/tiles" decision). Screens not
// built yet show a simple "coming soon" placeholder rather than being
// left broken or absent — see showScreen() in app.js.
const NAV_ITEMS = [
  { id: 'journal', label: 'Summary', icon: 'journal' },
  // 2026-08-05, confirmed in chat: 'sabaq'/'sabaqDhor'/'dhor' removed
  // entirely -- all 3 already live together on the detail screen
  // (logDetail), so 3 separate placeholder entries pointing at the same
  // underlying screen were redundant. 'logDetail' below is the one real
  // entry point for it now (uses the user-supplied 'detail' icon).
  { id: 'logDetail', label: 'Detail', icon: 'detail' },
  { id: 'reflections', label: 'Tadabbur', icon: 'reflections' },
  // V3.41.1: "Progress" (the coming-soon placeholder for the gamified
  // dhor-rings visual map, never actually built -- see TODO.md's spec
  // for it) deleted entirely, confirmed in chat -- no dependents, this
  // one entry was the whole thing.
  // V3.40: Juz Tracker, Phase 1 (free play) -- a standalone Kaaba-puzzle
  // widget, no backend tie-in yet. Same unconditional visibility as every
  // other item here; no student/teacher split exists anywhere in NAV_ITEMS
  // yet (confirmed in chat -- the whole app is personal-to-user today, the
  // Maktab/teacher phase hasn't started), so there's nothing to gate on.
  { id: 'juzTracker', label: 'Juz Tracker', icon: 'juzTracker' },   // V3.99.0: relabelled "Kaaba puzzle" for teaching profiles — see juzTrackerLabel()
  // V3.46.0: Surahs in my Heart — the colouring activity (js/sihScreen.js),
  // confirmed in chat. Same unconditional visibility as every other item;
  // deliberately NOT connected to any progress tracking.
  { id: 'sih', label: 'Surahs in my Heart', icon: 'sih' },
  { id: 'settings', label: 'Settings', icon: 'settings' }
];
// Admin-only destination — appended conditionally, not shown to students/
// teachers even though the backend already 403s them regardless (this is
// just about not showing a button that would only ever fail for them).
const ADMIN_NAV_ITEM = { id: 'admin', label: 'Admin', icon: 'admin' };
// V3.39: shown only once the student has opted in via the Setup Haidh
// section's "Haaidha" checkbox (track_haidh) — matches the field's own
// female-only gating (a male student's track_haidh can never become true
// through the normal Setup UI), so gating on this one flag is enough,
// no separate gender check needed here.
// V3.80.0: the Haidh nav item became ATTENDANCE, for EVERY student (the
// user's attendance-page spec, 2026-08-28) — the haidh calendar lives
// inside the page now, shown there for haa'idah only. The track_haidh
// nav gate went with it: attendance is everyone's.
const ATTENDANCE_NAV_ITEM = { id: 'attendancePage', label: 'Attendance', icon: 'attendance' };
// V3.98.0 (user): the LABEL is the same for everyone; the DESTINATION
// follows the role — a student lands on her own attendance page, a
// teacher/admin on the maktab-wide Attendance screen. The per-student
// view keeps its own door: the icon beside her name on the summary.
const MAKTAB_ATTENDANCE_NAV_ITEM = { id: 'maktabAttendance', label: 'Attendance', icon: 'attendance' };
// V3.59.0 (maktab delivery (e1), confirmed in chat): the maktab summary
// is teacher+ only (admin counts as teacher everywhere — same hierarchy
// as the worker's isTeacherOrAbove); the student's own read-only Maktab
// Journal is for everyone. This build is maktab-deployment-only, so
// every user here IS maktab-connected — no "has a maktab?" gate needed.
const MAKTAB_SUMMARY_NAV_ITEM = { id: 'maktabSummary', label: 'Maktab', icon: 'maktab' };
// V3.65.0 (delivery (g)): admin-only, like the Admin item — a teacher
// never sees the maktab settings, though their cards read the mushaf.
const MAKTAB_SETTINGS_NAV_ITEM = { id: 'maktabSettings', label: 'Maktab Settings', icon: 'settings' };
const MAKTAB_JOURNAL_NAV_ITEM = { id: 'maktabJournal', label: 'Maktab Journal', icon: 'journal' };
const MAKTAB_CALENDAR_NAV_ITEM = { id: 'maktabCalendar', label: 'Calendar', icon: 'calendar' };   // V3.87.0: everyone; students read-only. V3.98.1: its own glyph — the check-calendar now means attendance alone.

// V3.70.0: the personal journal is hidden FOR TEACHING PROFILES ONLY.
// Confirmed in chat 2026-08-17: "those items are only hidden for teacher
// profiles. Students see everything except admin profiles." V3.69.0 hid
// them from everyone, which was too broad — it took the personal journal
// away from the students whose journal it is.
//
// This is still not the real account separation: (j) is what makes a
// teaching account a distinct kind of account that never has a journal.
// Until then `role` is the only discriminator available, and it happens to
// give the right answer, because an account that teaches is exactly the one
// that should not be offered a personal journal.
//
// Reversible in one place: emptying this set restores everything.
const HIDDEN_PJ_NAV_IDS = new Set([
  'journal',      // Summary
  'logDetail',    // Detail — the single entry point to the three log cards
  'reflections',  // Tadabbur
  'settings',     // personal Settings
  'attendancePage',  // her personal attendance (and haidh calendar) — see below
]);
// Hiding 'attendancePage' removes the route to the personal page and
// NOTHING else. track_haidh keeps its value, the maktab's own haidh marking
// from (e2) is untouched, and (f)'s derived attendance keeps propagating
// haidh across maktab days unchanged.
// 'sih' (Surahs in my Heart) is deliberately NOT in this set: never named
// in chat, and it is an activity rather than a journal screen.

// Admin counts as a teacher everywhere else in this codebase
// (isTeacherOrAbove), and does here too: ADMIN-01 is the maktab teacher.
// V3.99.0 (user): for the MAKTAB the screen is a puzzle, not a tracker —
// a teacher/admin has no hifz of their own on it. Students keep "Juz
// Tracker", which is exactly what it is for them.
function juzTrackerLabel(){
  return isTeachingProfile() ? 'Kaaba puzzle' : 'Juz Tracker';
}

function isTeachingProfile(){
  return currentUser.role === 'teacher' || currentUser.role === 'admin';
}

// V3.74.2: the menu is ordered in THREE GROUPS, confirmed 2026-08-26:
//   1  Home, Maktab, Maktab Settings, Admin   — where you work
//   2  Surahs in my Heart, Juz Tracker, Timer — personal tools
//   3  Refresh, Log out                        — session actions (added by
//                                                the caller, not here)
//
// Built as groups rather than one flat ordered list because most items are
// role-gated: a student sees group 1 as Home alone. Emitting a divider per
// gap would leave her a stray line under a single item, so empty groups
// are dropped and dividers only appear BETWEEN surviving ones.
function visibleNavGroups(){
  const hidePJ = isTeachingProfile();
  const byId = (id) => NAV_ITEMS.find(x => x.id === id);
  const keep = (item) => item && !(hidePJ && HIDDEN_PJ_NAV_IDS.has(item.id));

  // Home, Timer, Refresh and Log out are not in NAV_ITEMS — they are not
  // screens (Home is a tile grid, Timer a floating panel, the other two
  // actions), so they are marked here and rendered from their own ids.
  const g1 = [{ id: 'home', label: 'Home', icon: 'home', raw: 'homeDropdownBtn' }];
  if(isTeachingProfile()) g1.push(MAKTAB_SUMMARY_NAV_ITEM);
  if(currentUser.role === 'admin') g1.push(MAKTAB_SETTINGS_NAV_ITEM, ADMIN_NAV_ITEM);

  // V3.99.0: the label follows the role — "Kaaba puzzle" in the maktab
  const g2 = [byId('sih'), byId('juzTracker')].filter(keep)
    .map(x => x.id === 'juzTracker' ? Object.assign({}, x, { label: juzTrackerLabel() }) : x);
  g2.push({ id: 'timer', label: 'Timer', icon: 'timer', raw: 'timerDropdownBtn' });

  // The student's own Maktab Journal and the PJ screens keep their place
  // among the personal tools — they are hers, not maktab machinery.
  const g3 = NAV_ITEMS.filter(x => keep(x) && !['home', 'sih', 'juzTracker'].includes(x.id));
  if(!hidePJ) g3.push(MAKTAB_JOURNAL_NAV_ITEM);
  // V3.98.0: teachers/admins get the MAKTAB attendance screen under the
  // same label; students keep their own page exactly as before.
  if(isTeachingProfile()) g3.push(MAKTAB_ATTENDANCE_NAV_ITEM);
  else if(!(hidePJ && HIDDEN_PJ_NAV_IDS.has(ATTENDANCE_NAV_ITEM.id))) g3.push(ATTENDANCE_NAV_ITEM);   // V3.80.0: every student, not just haa'idah
  g3.push(MAKTAB_CALENDAR_NAV_ITEM);   // V3.87.0: the maktab calendar, read-only for students

  const g4 = [
    { id: 'refresh', label: 'Refresh', icon: 'refresh', raw: 'refreshBtn' },
    { id: 'switchAccount', label: 'Switch account', icon: 'switchAccount', raw: 'switchAccountBtn' },   // V3.77.0 (j)
    { id: 'logout', label: 'Log out', icon: 'logout', raw: 'logoutBtn' },
  ];
  // g3 (the PJ screens) folds into the personal-tools group; a student
  // otherwise gets two adjacent groups of her own things.
  return [g1.filter(Boolean), g2.concat(g3), g4].filter(g => g.length);
}

// Flat list, order preserved — kept for callers that just want the items
// (the Home tile grid, and every existing test).
function visibleNavItems(){
  return visibleNavGroups().flat();
}

function renderNavItemsInto(containerId, extraItemsHtml){
  const el = document.getElementById(containerId);
  // V3.41.1: icon now wrapped in its own span (.nav-icon-item-icon),
  // separate from the label -- confirmed in chat: Home's tiles need the
  // square/border/shadow/background chip around the ICON ONLY, with the
  // label sitting below it, OUTSIDE that box, not sharing one shared box
  // together. Neutral/unstyled by default (see css/base.css) so the
  // dropdown menu's own plain icon+label look is unaffected -- only
  // #homeGrid's own CSS (css/nav.css) gives the chip its visual treatment.
  // V3.74.2: grouped, with dividers only BETWEEN surviving groups — never a
  // trailing line under a group that role-gating emptied.
  // An item with `raw` is not a screen (Home, Timer, Refresh, Log out); it
  // gets its own id so its existing listener still finds it, and no
  // data-nav, so the generic screen handler leaves it alone.
  const btn = (item) => item.raw
    ? `<button class="nav-icon-item" id="${item.raw}"><span class="nav-icon-item-icon">${iconHtml(item.icon)}</span><span class="nav-icon-item-label">${item.label}</span></button>`
    : `<button class="nav-icon-item" data-nav="${item.id}"><span class="nav-icon-item-icon">${iconHtml(item.icon)}</span><span class="nav-icon-item-label">${item.label}</span></button>`;
  const grouped = (containerId === 'authDropdownNav')
    ? visibleNavGroups().map(g => g.map(btn).join('')).join('<div class="dropdown-divider"></div>')
    : visibleNavItems().filter(i => !i.raw).map(btn).join('');   // Home tiles: screens only
  el.innerHTML = grouped + (extraItemsHtml || '');
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

// 2026-08-03: #authDropdown is now position:fixed (css/nav.css) so it
// stays visible regardless of scroll position, rather than opening in
// its old document-flow spot near the top of the page. The band's real
// height isn't a fixed number (it grows for a device's notch via
// env(safe-area-inset-top)), so it's measured live here instead of
// guessed at in CSS -- only needs to happen on open, since that's the
// only moment the dropdown's position is actually visible/relevant.
function toggleAuthDropdown(){
  const dd = document.getElementById('authDropdown');
  const toggle = document.getElementById('authBandToggle');
  const opening = !dd.classList.contains('open');
  if(opening){
    const bandHeight = document.getElementById('authBand').getBoundingClientRect().height;
    document.getElementById('appShell').style.setProperty('--auth-band-height', bandHeight + 'px');
  }
  dd.classList.toggle('open', opening);
  toggle.classList.toggle('open', opening);
}
function closeAuthDropdown(){
  document.getElementById('authDropdown').classList.remove('open');
  document.getElementById('authBandToggle').classList.remove('open');
}

function setupAuthBandAndDropdown(){
  // V3.74.2: Home/Timer/Refresh/Log out are no longer appended as raw HTML
  // after the items — they could not be interleaved into the requested
  // order that way. visibleNavGroups() places them; their ids and existing
  // listeners are unchanged.
  renderNavItemsInto('authDropdownNav');
  document.getElementById('authBandToggle').innerHTML = iconHtml('menu');
  document.getElementById('authBandToggle').addEventListener('click', toggleAuthDropdown);
  document.getElementById('homeDropdownBtn').addEventListener('click', () => {
    closeAuthDropdown();
    // V3.74.1: back to Home for everyone. V3.71.0 pointed this at the
    // maktab summary while trying to change where the app LANDS — the
    // wrong target entirely, and it made the Home button not go home.
    // Landing is decided in bootApp (js/app.js), fixed in V3.74.0.
    // A button labelled Home goes Home.
    showScreen('home');
  });
  document.getElementById('timerDropdownBtn').addEventListener('click', () => {
    closeAuthDropdown();
    openFloatingTimer();
  });
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    location.reload();
  });
  // V3.77.0 (j): log out, then land on the switcher instead of the PIN
  // screen for the account just left. The token goes first — the switcher
  // never carries a session across accounts.
  document.getElementById('switchAccountBtn').addEventListener('click', () => {
    clearToken();
    requestAccountSwitch();
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
const ALL_LOGIN_SCREENS = ['loginScreenFallback','loginScreenPersonal','createPinScreen','registerScreen','registeredScreen','loginScreenSwitch'];   // loginScreenSwitch: V3.77.0 (j)
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
  // V3.77.0 (j): "Switch account" from the menu reloads with this flag set —
  // show the device's known accounts before anything else. Consumed on read
  // so a plain refresh afterwards routes normally.
  if(consumeAccountSwitchRequest() && getKnownAccounts().length){
    showSwitchScreen();
    return;
  }
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

// ---------- V3.77.0 (j): the switcher ----------
// Device-local, PIN always (agreed 2026-08-16). A chip per account that has
// signed in here; tapping it makes that id the remembered one and routes to
// the PIN screen — the same personal/create-PIN screens every login uses.
// A teacher who also does hifz therefore moves between her two unlinked
// accounts with one tap and four digits, never typing an id.
function showSwitchScreen(){
  hideAllLoginScreens();
  renderSwitchAccountList();
  document.getElementById('loginScreenSwitch').classList.remove('hidden');
}
function renderSwitchAccountList(){
  const host = document.getElementById('switchAccountList');
  const accounts = getKnownAccounts();
  if(!accounts.length){
    host.innerHTML = '<div class="switch-account-empty">No accounts have signed in on this device yet.</div>';
    return;
  }
  host.innerHTML = accounts.map(a => `
    <div class="switch-account-row">
      <button type="button" class="switch-account-chip" data-switch-id="${a.id}">
        <span class="switch-account-name">${escapeHtmlForSwitch(a.name)}</span>
        ${a.role !== 'student' ? `<span class="switch-account-role">${escapeHtmlForSwitch(a.role)}</span>` : ''}
      </button>
      <button type="button" class="icon-btn switch-account-forget" data-forget-id="${a.id}" aria-label="Forget ${escapeHtmlForSwitch(a.name)} on this device">${iconHtml('close')}</button>
    </div>
  `).join('');
  host.querySelectorAll('[data-switch-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.switchId;
      rememberLoginId(id);
      replaceUrlWithLoginId(id);
      routeToLoginScreen();   // lookup → PIN screen (or create-PIN on a teaching account's first login)
    });
  });
  host.querySelectorAll('[data-forget-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.forgetId;
      forgetKnownAccount(id);
      if(getRememberedLoginId() === id) forgetRememberedLoginId();
      renderSwitchAccountList();
    });
  });
}
function escapeHtmlForSwitch(v){ const d = document.createElement('span'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }

// "Use another ID" from the PIN screens: with known accounts on the device,
// offer them first; otherwise the plain ID+PIN screen as before.
function switchLoginAccount(){
  clearToken();
  forgetRememberedLoginId();
  if(getKnownAccounts().length){
    showSwitchScreen();
    return;
  }
  window.location.replace('/');
}
document.getElementById('personalSwitchAccountBtn').addEventListener('click', switchLoginAccount);
document.getElementById('createPinSwitchAccountBtn').addEventListener('click', switchLoginAccount);
// From the switch screen, the plain ID+PIN screen is one link away.
document.getElementById('switchUseAnotherIdBtn').addEventListener('click', () => { window.location.replace('/'); });

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
