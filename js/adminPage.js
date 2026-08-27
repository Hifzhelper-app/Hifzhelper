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
  cancelAdminMatch();
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
        <!-- V3.74.2: the id is no longer shown in the list. Copy still
             copies it, search still matches on it, and tapping the name
             still reveals it — it is simply not on screen by default. -->
        <span class="mono admin-list-id" hidden>${u.id}</span>
        <span class="admin-list-name ${u.active ? '' : 'inactive'}">${u.name}</span>
        ${u.role !== 'student' ? `<span class="admin-role-chip">${u.role}</span>` : ''}
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
// V3.77.0 (j): the teaching id is the student's id + 'TEACHER' (worker
// convention, admin.js). The list is the only place both rows are visible,
// so "has a teaching profile" is computed here from it — nothing in the
// data links the two rows.
const TEACHING_ID_SUFFIX = 'TEACHER';
function teachingProfileFor(studentId){
  return adminUsers.find(u => u.id === studentId + TEACHING_ID_SUFFIX) || null;
}
function isTeachingId(id){ return typeof id === 'string' && id.endsWith(TEACHING_ID_SUFFIX) && id.length > TEACHING_ID_SUFFIX.length; }

function openUserCard(id){
  const user = adminUsers.find(u => u.id === id);
  if(!user) return;
  // V3.77.0 (j): the create action is offered ONLY on an active student row
  // that has no teaching profile yet — never on a teaching account, never
  // twice (both also refused by the worker).
  const teaching = user.role === 'student' ? teachingProfileFor(user.id) : null;
  const canCreateTeaching = user.role === 'student' && user.active && !teaching;
  const derivedFrom = isTeachingId(user.id) ? adminUsers.find(u => u.id === user.id.slice(0, -TEACHING_ID_SUFFIX.length)) : null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-card">
    <button class="close-btn">&times;</button>
    <h2>${user.id}</h2>
    <label>Name</label>
    <input type="text" id="uc_name" value="${user.name}">
    <label>WhatsApp number</label>
    <input type="text" id="uc_whatsapp" value="${user.whatsapp_number || ''}">
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
    ${canCreateTeaching ? `<div class="modal-actions"><button class="secondary" id="uc_create_teaching">Create teaching profile</button></div>` : ''}
    ${teaching ? `<div class="form-hint" id="uc_teaching_note">Teaching profile: <span class="mono">${teaching.id}</span>${teaching.active ? '' : ' (inactive)'}</div>` : ''}
    ${derivedFrom ? `<div class="form-hint" id="uc_derived_note">Teaching profile of ${derivedFrom.name} (<span class="mono">${derivedFrom.id}</span>)</div>` : ''}
  </div>`;
  document.body.appendChild(overlay);

  // V3.77.0 (j): create the teaching profile from this student's row.
  const createBtn = document.getElementById('uc_create_teaching');
  if(createBtn){
    createBtn.addEventListener('click', async () => {
      const errEl = document.getElementById('uc_error');
      errEl.textContent = '';
      if(!confirm(`Create a teaching profile for ${user.name}? Her teaching ID will be ${user.id}${TEACHING_ID_SUFFIX}. She sets its PIN on first login.`)) return;
      try{
        const result = await apiAdminCreateTeachingProfile(user.id);
        overlay.remove();
        await loadAdminUsers();
        showBanner(`Teaching profile created: ${result.id}`);
      } catch(e){
        errEl.textContent = "Couldn't create the teaching profile: " + e.message;
      }
    });
  }

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
// Matches self-registration's structure (V3.4.2): the form fields stay
// visible and editable the whole time — Continue always re-submits with
// whatever is CURRENTLY in the fields, so editing them first (to fix a
// typo, or to no longer collide with anything) and then hitting Continue
// naturally becomes an ordinary registration instead of a forced
// duplicate. V3.4.3: Continue reads the match info back from that SAME
// force:true call rather than the adminMatchedId variable, so it can
// never act on a stale match — adminMatchedId is kept only for Reset PIN,
// which intentionally always targets whichever student was matched when
// the prompt first appeared, regardless of any edits made afterward.
let adminMatchedId = null;

document.getElementById('adminRegisterBtn').addEventListener('click', attemptAdminRegister);
document.getElementById('adminRegisterContinueBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('adminRegisterError');
  errEl.textContent = '';
  const name = document.getElementById('admin_new_name').value.trim();
  const whatsapp = document.getElementById('admin_new_whatsapp').value.trim();
  try{
    const result = await apiAdminRegisterStudent(name, whatsapp || null, true);
    if(result.matchedId && confirm('CANCEL: Both journals remain active ; OK: mark existing journal INACTIVE')){
      try{ await apiAdminUpdateUser(result.matchedId, { active: false }); }
      catch(e){ errEl.textContent = "Registered, but couldn't deactivate the existing student: " + e.message; }
    }
    finishAdminRegisterUI(result);
  } catch(e){
    errEl.textContent = "Couldn't register: " + e.message;
  }
});
document.getElementById('adminRegisterCancelBtn').addEventListener('click', cancelAdminMatch);
document.getElementById('adminRegisterResetPinBtn').addEventListener('click', async () => {
  if(!adminMatchedId) return;
  if(!confirm("Reset the existing student's PIN?")) return;
  try{
    await apiAdminResetPin(adminMatchedId);
    showBanner('PIN reset for the existing student.');
    cancelAdminMatch();
  } catch(e){
    showBanner("Couldn't reset PIN: " + e.message);
  }
});

async function attemptAdminRegister(){
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
      adminMatchedId = result.matchedId;
      // V3.4.3 item 5: identifies the actual matched student, since the
      // admin list can have several similarly-named entries.
      document.getElementById('adminRegisterMatchHint').textContent =
        `Student: ${name}, WhatsApp number: ${whatsapp || '(none given)'} has the same details and is currently ${result.matchedActive ? 'active' : 'inactive'}. How do you want to proceed?`;
      document.getElementById('adminRegisterMatchHint').classList.remove('hidden');
      document.getElementById('adminRegisterNormalActions').classList.add('hidden');
      document.getElementById('adminRegisterMatchActions').classList.remove('hidden');
    } else {
      finishAdminRegisterUI(result);
    }
  } catch(e){
    errEl.textContent = "Couldn't register: " + e.message;
  }
}

function cancelAdminMatch(){
  adminMatchedId = null;
  document.getElementById('adminRegisterMatchHint').classList.add('hidden');
  document.getElementById('adminRegisterMatchActions').classList.add('hidden');
  document.getElementById('adminRegisterNormalActions').classList.remove('hidden');
}

function finishAdminRegisterUI(result){
  cancelAdminMatch();
  document.getElementById('admin_new_name').value = '';
  document.getElementById('admin_new_whatsapp').value = '';
  document.getElementById('adminRegisterResult').textContent =
    `Created — ID: ${result.id}. Share this with ${result.name} so they can log in for the first time.`;
  loadAdminUsers();
}
