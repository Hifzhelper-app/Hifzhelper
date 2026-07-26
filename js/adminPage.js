// ============================================================
// Hifzhelper — Admin screen
// Compact searchable list (ID / Name / Status) — selecting a row opens a
// detail card with every editable value (name, role, reset PIN, delete).
// Gated to role === 'admin' both here (nav entry only appears for admins)
// and server-side (every /admin/* endpoint 403s anyone else regardless).
// ============================================================

let adminUsers = [];

async function renderAdminScreen(){
  document.getElementById('adminRegisterError').textContent = '';
  document.getElementById('adminRegisterResult').textContent = '';
  document.getElementById('admin_new_name').value = '';
  document.getElementById('admin_new_whatsapp').value = '';
  document.getElementById('adminRegisterFormWrap').classList.remove('hidden');
  document.getElementById('adminRegisterMatchPrompt').classList.add('hidden');
  document.getElementById('admin_search').value = '';
  await loadAdminUsers();
}

async function loadAdminUsers(){
  const list = document.getElementById('adminUsersList');
  list.innerHTML = `<div class="admin-list-empty">Loading…</div>`;
  try{
    adminUsers = await apiAdminListUsers();
    renderAdminUsersList();
  } catch(e){
    list.innerHTML = `<div class="admin-list-empty" style="color:var(--color-error);">Couldn't load: ${e.message}</div>`;
  }
}

function renderAdminUsersList(){
  const query = (document.getElementById('admin_search').value || '').trim().toLowerCase();
  const filtered = adminUsers.filter(u =>
    !query || u.id.toLowerCase().includes(query) || u.name.toLowerCase().includes(query)
  );
  const list = document.getElementById('adminUsersList');
  const canShare = typeof navigator.share === 'function';
  list.innerHTML = filtered.map(u => `
    <div class="admin-list-row">
      <button type="button" class="admin-list-open" data-open-user="${u.id}">
        <span class="mono">${u.id}</span>
        <span class="admin-list-name ${u.active ? '' : 'inactive'}">${u.name}</span>
      </button>
      <button type="button" class="icon-btn" data-copy-url="${u.id}" aria-label="Copy personal URL"></button>
      ${canShare ? `<button type="button" class="icon-btn" data-share-url="${u.id}" aria-label="Share personal URL"></button>` : ''}
    </div>
  `).join('') || `<div class="admin-list-empty">No matching users.</div>`;

  list.querySelectorAll('[data-open-user]').forEach(btn => {
    btn.addEventListener('click', () => openUserCard(btn.dataset.openUser));
  });
  list.querySelectorAll('[data-copy-url]').forEach(btn => {
    btn.innerHTML = iconHtml('copy');
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = window.location.origin + '/' + btn.dataset.copyUrl;
      try{ await navigator.clipboard.writeText(url); } catch(err){ /* nothing else to fall back to inline here */ }
      btn.innerHTML = iconHtml('check');
      btn.classList.add('copied');
      setTimeout(() => { btn.innerHTML = iconHtml('copy'); btn.classList.remove('copied'); }, 1500);
    });
  });
  list.querySelectorAll('[data-share-url]').forEach(btn => {
    btn.innerHTML = iconHtml('share');
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = window.location.origin + '/' + btn.dataset.shareUrl;
      try{ await navigator.share({ url }); } catch(err){ /* user cancelled, or share failed — not shown as an error */ }
    });
  });
}

document.getElementById('admin_search').addEventListener('input', renderAdminUsersList);

// ---------- user detail card ----------
function openUserCard(id){
  const user = adminUsers.find(u => u.id === id);
  if(!user) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-card">
    <button class="close-btn">&times;</button>
    <h2>${user.id}</h2>
    <label>Name</label>
    <input type="text" id="uc_name" value="${user.name}">
    <label>WhatsApp number</label>
    <input type="text" id="uc_whatsapp" value="${user.whatsapp_number || ''}" placeholder="Optional">
    <label>Role</label>
    <select id="uc_role">
      <option value="student" ${user.role==='student'?'selected':''}>Student</option>
      <option value="teacher" ${user.role==='teacher'?'selected':''}>Teacher</option>
      <option value="admin" ${user.role==='admin'?'selected':''}>Admin</option>
    </select>
    <label style="display:flex;align-items:center;gap:8px;margin-top:8px;">
      <input type="checkbox" id="uc_active" style="width:auto;" ${user.active ? 'checked' : ''}>
      Active
    </label>
    <div class="form-error" id="uc_error"></div>
    <div class="modal-actions">
      <button class="secondary" id="uc_cancel">Cancel</button>
      <button class="primary" id="uc_save">Save</button>
    </div>
    <div class="modal-actions">
      <button class="secondary" id="uc_reset_pin">Reset PIN</button>
      <button class="secondary danger" id="uc_delete">Delete user</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
  overlay.querySelector('.close-btn').addEventListener('click', () => overlay.remove());
  document.getElementById('uc_cancel').addEventListener('click', () => overlay.remove());

  document.getElementById('uc_save').addEventListener('click', async () => {
    const errEl = document.getElementById('uc_error');
    errEl.textContent = '';
    const newName = document.getElementById('uc_name').value.trim();
    const newWhatsapp = document.getElementById('uc_whatsapp').value.trim();
    const newRole = document.getElementById('uc_role').value;
    const newActive = document.getElementById('uc_active').checked;
    if(!newName){ errEl.textContent = 'Name cannot be empty.'; return; }
    if(newRole !== user.role && !confirm(`Change ${user.id}'s role to "${newRole}"?`)) return;
    if(!newActive && user.active && !confirm(`Mark ${user.id} inactive? They won't be able to log in until reactivated.`)) return;
    try{
      const fields = {};
      if(newName !== user.name) fields.name = newName;
      if(newWhatsapp !== (user.whatsapp_number || '')) fields.whatsapp_number = newWhatsapp;
      if(newActive !== !!user.active) fields.active = newActive;
      if(Object.keys(fields).length) await apiAdminUpdateUser(user.id, fields);
      if(newRole !== user.role) await apiAdminChangeRole(user.id, newRole);
      overlay.remove();
      await loadAdminUsers();
    } catch(e){
      errEl.textContent = "Couldn't save: " + e.message;
    }
  });

  document.getElementById('uc_reset_pin').addEventListener('click', async () => {
    if(!confirm(`Reset ${user.id}'s PIN? They'll set a new one on their next login.`)) return;
    try{
      await apiAdminResetPin(user.id);
      showBanner(`PIN reset for ${user.id}.`);
    } catch(e){
      showBanner("Couldn't reset PIN: " + e.message);
    }
  });

  document.getElementById('uc_delete').addEventListener('click', async () => {
    if(!confirm(`Delete ${user.id} (${user.name}) permanently? This cannot be undone.`)) return;
    try{
      await apiAdminDeleteUser(user.id);
      overlay.remove();
      await loadAdminUsers();
    } catch(e){
      // deliberately shown inline, not as a passing banner — this is the
      // "blocked because history exists" case and the admin should see it clearly
      document.getElementById('uc_error').textContent = e.message;
    }
  });
}

// ---------- register new student ----------
document.getElementById('adminRegisterBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('adminRegisterError');
  const resultEl = document.getElementById('adminRegisterResult');
  errEl.textContent = '';
  resultEl.textContent = '';
  const name = document.getElementById('admin_new_name').value.trim();
  const whatsapp = document.getElementById('admin_new_whatsapp').value.trim();
  if(!name){ errEl.textContent = 'Enter a name.'; return; }

  try{
    const result = await apiAdminRegisterStudent(name, whatsapp || null, false);
    if(result.matched){
      showAdminRegisterMatchPrompt(name, whatsapp, result.matchedId);
    } else {
      finishAdminRegisterUI(result);
    }
  } catch(e){
    errEl.textContent = "Couldn't register: " + e.message;
  }
});

// A matching name+WhatsApp already exists among active students — offer
// Continue (register anyway, with an option to also deactivate the old
// one — a direct action here, since admin already has that capability) or
// Reset PIN on the existing student directly (V3.4.1).
function showAdminRegisterMatchPrompt(name, whatsapp, matchedId){
  document.getElementById('adminRegisterFormWrap').classList.add('hidden');
  document.getElementById('adminRegisterMatchPrompt').classList.remove('hidden');

  document.getElementById('adminRegisterContinueBtn').onclick = async () => {
    const errEl = document.getElementById('adminRegisterError');
    errEl.textContent = '';
    if(confirm('Also mark the existing student inactive?')){
      try{ await apiAdminUpdateUser(matchedId, { active: false }); }
      catch(e){ errEl.textContent = "Registered the new student, but couldn't deactivate the existing one: " + e.message; }
    }
    try{
      const result = await apiAdminRegisterStudent(name, whatsapp || null, true);
      finishAdminRegisterUI(result);
    } catch(e){
      errEl.textContent = "Couldn't register: " + e.message;
    }
  };

  document.getElementById('adminRegisterResetPinBtn').onclick = async () => {
    if(!confirm("Reset the existing student's PIN?")) return;
    try{
      await apiAdminResetPin(matchedId);
      showBanner('PIN reset for the existing student.');
      resetAdminRegisterForm();
    } catch(e){
      showBanner("Couldn't reset PIN: " + e.message);
    }
  };
}

function finishAdminRegisterUI(result){
  resetAdminRegisterForm();
  document.getElementById('adminRegisterResult').textContent =
    `Created — ID: ${result.id}. Share this with ${result.name} so they can log in for the first time.`;
  loadAdminUsers();
}

function resetAdminRegisterForm(){
  document.getElementById('adminRegisterFormWrap').classList.remove('hidden');
  document.getElementById('adminRegisterMatchPrompt').classList.add('hidden');
  document.getElementById('admin_new_name').value = '';
  document.getElementById('admin_new_whatsapp').value = '';
}
