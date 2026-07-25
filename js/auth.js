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
  { id: 'plans', label: 'Plans', icon: 'plans' },
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
    `<button class="nav-icon-item" id="logoutBtn">${iconHtml('logout')}<span>Sign out</span></button>` +
    `<button class="nav-icon-item" id="refreshBtn">${iconHtml('refresh')}<span>Refresh</span></button>`
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

// PIN entry: 4 separate digit boxes, auto-advancing as each fills, with
// backspace on an empty box moving focus back to the previous one.
['pin_1','pin_2','pin_3','pin_4'].forEach((id, i, arr) => {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    el.value = el.value.replace(/[^0-9]/g, '').slice(0,1);
    if(el.value && i < arr.length - 1) document.getElementById(arr[i+1]).focus();
  });
  el.addEventListener('keydown', (e) => {
    if(e.key === 'Backspace' && !el.value && i > 0) document.getElementById(arr[i-1]).focus();
  });
});
function readPinDigits(){
  return ['pin_1','pin_2','pin_3','pin_4'].map(id => document.getElementById(id).value).join('');
}
function clearPinDigits(){
  ['pin_1','pin_2','pin_3','pin_4'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('pin_1').focus();
}

// ---------- login screen ----------
document.getElementById('loginBtn').addEventListener('click', async () => {
  const id = document.getElementById('login_id').value.trim();
  const pin = readPinDigits();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  if(!id || !/^\d{4}$/.test(pin)){
    errEl.textContent = 'Enter your ID and a 4-digit PIN.';
    return;
  }
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  try{
    const loginResult = await apiLogin(id, pin);
    await bootApp();
    if(loginResult.firstLogin) showFirstLoginMessage();
  } catch(e){
    errEl.textContent = e.message;
    clearPinDigits();
  } finally {
    btn.disabled = false;
  }
});

function showLoginScreen(){
  document.getElementById('registerScreen').classList.add('hidden');
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appShell').style.display = 'none';
}
function showRegisterScreen(){
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('registerScreen').classList.remove('hidden');
  document.getElementById('registerScreen').style.display = 'flex';
}
function showAppShell(){
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('registerScreen').classList.add('hidden');
  document.getElementById('appShell').style.display = 'flex';
}

document.getElementById('showRegisterBtn').addEventListener('click', showRegisterScreen);
document.getElementById('showLoginBtn').addEventListener('click', showLoginScreen);

document.getElementById('registerBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('registerError');
  const resultEl = document.getElementById('registerResult');
  errEl.textContent = '';
  resultEl.textContent = '';
  const name = document.getElementById('register_name').value.trim();
  const whatsapp = document.getElementById('register_whatsapp').value.trim();
  if(!name){ errEl.textContent = 'Enter your name.'; return; }

  const btn = document.getElementById('registerBtn');
  btn.disabled = true;
  try{
    const result = await apiRegister(name, whatsapp || null);
    resultEl.textContent = `Registered! Your ID is ${result.id} — enter it on the sign-in screen along with a new 4-digit PIN to get started.`;
    document.getElementById('register_name').value = '';
    document.getElementById('register_whatsapp').value = '';
    document.getElementById('login_id').value = result.id;
  } catch(e){
    errEl.textContent = "Couldn't register: " + e.message;
  } finally {
    btn.disabled = false;
  }
});

// First-login: a one-time message to save the URL / add to home screen,
// since there's no other account-recovery path if this browser tab is
// the only place the login ever happens.
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
