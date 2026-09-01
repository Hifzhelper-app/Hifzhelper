// ============================================================
// Hifzhelper — Admin screen
// Compact searchable list (ID / Name / Status) — selecting a row opens a
// detail card with every editable value (name, role, reset PIN, delete).
// Gated to role === 'admin' both here (nav entry only appears for admins)
// and server-side (every /admin/* endpoint 403s anyone else regardless).
// ============================================================

let adminUsers = [];

// V4.1.0: the add row — the register box, revealed by "+ Add new
// student" and hidden again once the student is created. Its fields,
// its duplicate-name guard and its Continue/Cancel path are untouched.
function adminShowAddRow(show){
  const box = document.getElementById('adminRegisterBox');
  const btn = document.getElementById('adminAddRowBtn');
  if(!box || !btn) return;
  box.classList.toggle('hidden', !show);
  btn.classList.toggle('hidden', show);
  if(show) document.getElementById('admin_new_name').focus();
}

async function renderAdminScreen(){
  document.getElementById('adminRegisterError').textContent = '';
  document.getElementById('adminRegisterResult').textContent = '';
  document.getElementById('admin_new_name').value = '';
  document.getElementById('admin_new_whatsapp').value = '';
  cancelAdminMatch();
  adminShowAddRow(false);   // V4.1.0
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

// ============================================================
// V4.1.0 (user's mock, 2026-09-01) — ONE SCREEN, INLINE EDITING.
// The register box + list + detail card become a single table edited in
// place. Existing rows AUTOSAVE PER FIELD (the user's call — the mock's
// Save column existed only because the old screens had both register and
// save); a NEW row keeps one register action, because a create needs its
// fields together and must run the duplicate-name check.
//
// Nothing was dropped: copy, share, reset PIN, delete-with-confirm, the
// active toggle, the role change with its confirm, GROUP assignment and
// teaching-profile creation (both absent from the mock) all live on.
//
// Mobile: two rows per user — fields above, every icon/button below —
// tethered so the pair reads as one record.
// ============================================================
let adminGroupsCache = null;

function adminFlash(msg, isError){
  const el = document.getElementById('adminRowStatus');
  if(!el) return;
  el.textContent = msg;
  el.classList.toggle('is-error', !!isError);
  clearTimeout(adminFlash._t);
  adminFlash._t = setTimeout(() => { el.textContent = ''; el.classList.remove('is-error'); }, 2500);
}

// one field, saved the moment it changes; the row's own copy of the user
// is updated so later edits diff against the truth
async function adminSaveField(user, fields, describe){
  try{
    await apiAdminUpdateUser(user.id, fields);
    Object.assign(user, fields);
    adminFlash(describe + ' saved');
  } catch(e){
    adminFlash("Couldn't save: " + e.message, true);
    renderAdminUsersList();   // put the cell back to the stored value
  }
}

function renderAdminUsersList(){
  const query = (document.getElementById('admin_search').value || '').trim().toLowerCase();
  const filtered = adminUsers.filter(u =>
    !query || u.id.toLowerCase().includes(query) || u.name.toLowerCase().includes(query)
  );
  const list = document.getElementById('adminUsersList');
  const canShare = typeof navigator.share === 'function';
  if(!filtered.length){
    list.innerHTML = '<div class="admin-list-empty">No matching users.</div>';
    return;
  }

  list.innerHTML = `<table class="admin-table"><thead><tr>
      <th class="admin-th-id">Unique ID</th><th>Name</th><th>WhatsApp</th><th>Role</th>
      <th>Group</th><th>Teacher profile</th><th>Status</th><th class="admin-th-actions">Actions</th>
    </tr></thead><tbody></tbody></table>`;
  const tbody = list.querySelector('tbody');

  filtered.forEach(u => {
    const teaching = u.role === 'student' ? teachingProfileFor(u.id) : null;
    const canCreateTeaching = u.role === 'student' && u.active && !teaching;
    const derivedFrom = isTeachingId(u.id) ? adminUsers.find(x => x.id === u.id.slice(0, -TEACHING_ID_SUFFIX.length)) : null;

    const tr = document.createElement('tr');
    tr.className = 'admin-row admin-row-fields';
    tr.innerHTML = `
      <td class="mono admin-cell-id">${u.id}</td>
      <td><input type="text" class="admin-inline" data-f="name" value="${(u.name || '').replace(/"/g, '&quot;')}"></td>
      <td><input type="text" class="admin-inline" data-f="whatsapp_number" value="${(u.whatsapp_number || '').replace(/"/g, '&quot;')}"></td>
      <td><select class="admin-inline" data-f="role">
        <option value="student"${u.role === 'student' ? ' selected' : ''}>Student</option>
        <option value="teacher"${u.role === 'teacher' ? ' selected' : ''}>Teacher</option>
        <option value="admin"${u.role === 'admin' ? ' selected' : ''}>Admin</option>
      </select></td>
      <td>${u.role === 'student' ? '<select class="admin-inline" data-f="group_id" disabled><option>…</option></select>' : '<span class="admin-dash">—</span>'}</td>
      <td class="admin-cell-teaching">${
        teaching ? `<span class="mono admin-teaching-id">${teaching.id}</span>${teaching.active ? '' : ' <span class="admin-dash">(inactive)</span>'}`
        : canCreateTeaching ? '<input type="checkbox" class="admin-inline" data-create-teaching aria-label="Create teaching profile">'
        : derivedFrom ? `<span class="admin-dash">of ${derivedFrom.name}</span>`
        : '<span class="admin-dash">—</span>'}</td>
      <td><label class="admin-status"><input type="checkbox" class="admin-inline" data-f="active"${u.active ? ' checked' : ''}><span>${u.active ? 'Active' : 'Inactive'}</span></label></td>
      <td class="admin-actions-cell"></td>`;
    tbody.appendChild(tr);

    // the actions — their own row on mobile, the last cell on desktop
    const actionsHtml = `
      <button type="button" class="icon-btn" data-copy-url="${u.id}" aria-label="Copy personal URL"></button>
      ${canShare ? `<button type="button" class="icon-btn" data-share-url="${u.id}" aria-label="Share personal URL"></button>` : ''}
      <button type="button" class="secondary admin-pin-btn" data-reset-pin>Reset PIN</button>
      <button type="button" class="icon-btn admin-delete-btn" data-delete aria-label="Delete user"></button>`;
    tr.querySelector('.admin-actions-cell').innerHTML = actionsHtml;
    const trActions = document.createElement('tr');
    trActions.className = 'admin-row admin-row-actions';
    trActions.innerHTML = `<td colspan="8"><div class="admin-actions-strip">${actionsHtml}</div></td>`;
    tbody.appendChild(trActions);

    const wire = (scope) => {
      // ---- per-field autosave ----
      const nameEl = scope.querySelector('[data-f="name"]');
      if(nameEl) nameEl.addEventListener('change', () => {
        const v = nameEl.value.trim();
        if(!v){ adminFlash('Name cannot be empty.', true); nameEl.value = u.name; return; }
        if(v !== u.name) adminSaveField(u, { name: v }, 'Name');
      });
      const waEl = scope.querySelector('[data-f="whatsapp_number"]');
      if(waEl) waEl.addEventListener('change', () => {
        const v = waEl.value.trim();
        if(v !== (u.whatsapp_number || '')) adminSaveField(u, { whatsapp_number: v }, 'WhatsApp');
      });
      const roleEl = scope.querySelector('[data-f="role"]');
      if(roleEl) roleEl.addEventListener('change', async () => {
        const v = roleEl.value;
        if(v === u.role) return;
        if(!confirm(`Change ${u.id}'s role to "${v}"?`)){ roleEl.value = u.role; return; }
        try{ await apiAdminChangeRole(u.id, v); adminFlash('Role saved'); await loadAdminUsers(); }
        catch(e){ adminFlash("Couldn't change the role: " + e.message, true); roleEl.value = u.role; }
      });
      const activeEl = scope.querySelector('[data-f="active"]');
      if(activeEl) activeEl.addEventListener('change', async () => {
        const v = activeEl.checked;
        if(!v && u.active && !confirm(`Mark ${u.id} inactive? They won't be able to log in until reactivated.`)){
          activeEl.checked = true; return;
        }
        await adminSaveField(u, { active: v }, 'Status');
        renderAdminUsersList();
      });
      const groupEl = scope.querySelector('[data-f="group_id"]');
      if(groupEl) groupEl.addEventListener('change', () => {
        const v = groupEl.value === '' ? null : Number(groupEl.value);
        if(String(v ?? '') !== String(u.group_id ?? '')) adminSaveField(u, { group_id: v }, 'Group');
      });
      // ---- teaching profile: unchanged behaviour, its own confirm ----
      const teachEl = scope.querySelector('[data-create-teaching]');
      if(teachEl) teachEl.addEventListener('change', async () => {
        if(!teachEl.checked) return;
        if(!confirm(`Create a teaching profile for ${u.name}? Her teaching ID will be ${u.id}${TEACHING_ID_SUFFIX}. She sets its PIN on first login.`)){
          teachEl.checked = false; return;
        }
        try{
          const result = await apiAdminCreateTeachingProfile(u.id);
          adminFlash(`Teaching profile created: ${result.id}`);
          await loadAdminUsers();
        } catch(e){
          teachEl.checked = false;
          adminFlash("Couldn't create the teaching profile: " + e.message, true);
        }
      });
      // ---- the actions ----
      const copyBtn = scope.querySelector('[data-copy-url]');
      if(copyBtn){
        copyBtn.innerHTML = iconHtml('copy');
        copyBtn.addEventListener('click', async () => {
          try{ await navigator.clipboard.writeText(window.location.origin + '/' + u.id); } catch(err){ /* nothing to fall back to */ }
          copyBtn.innerHTML = iconHtml('check');
          copyBtn.classList.add('copied');
          setTimeout(() => { copyBtn.innerHTML = iconHtml('copy'); copyBtn.classList.remove('copied'); }, 1500);
        });
      }
      const shareBtn = scope.querySelector('[data-share-url]');
      if(shareBtn){
        shareBtn.innerHTML = iconHtml('share');
        shareBtn.addEventListener('click', async () => {
          try{ await navigator.share({ url: window.location.origin + '/' + u.id }); } catch(err){ /* cancelled */ }
        });
      }
      const pinBtn = scope.querySelector('[data-reset-pin]');
      if(pinBtn) pinBtn.addEventListener('click', async () => {
        if(!confirm(`Reset ${u.id}'s PIN? They'll set a new one on their next login.`)) return;
        try{ await apiAdminResetPin(u.id); adminFlash(`PIN reset for ${u.id}.`); }
        catch(e){ adminFlash("Couldn't reset PIN: " + e.message, true); }
      });
      const delBtn = scope.querySelector('[data-delete]');
      if(delBtn){
        delBtn.innerHTML = iconHtml('trash') || '&times;';
        delBtn.addEventListener('click', async () => {
          if(!confirm(`Delete ${u.id} (${u.name}) permanently? This cannot be undone.`)) return;
          try{ await apiAdminDeleteUser(u.id); await loadAdminUsers(); }
          catch(e){ adminFlash(e.message, true); }   // the "blocked because history exists" case
        });
      }
    };
    wire(tr); wire(trActions);

    // the group select, populated once and reused (V3.78.0 semantics kept:
    // a retired group she is already in stays selectable so a save cannot
    // silently move her)
    if(u.role === 'student'){
      const sel = tr.querySelector('[data-f="group_id"]');
      const fill = (groups) => {
        if(!sel) return;
        sel.innerHTML = '';
        [{ id: '', name: 'No group' }].concat(groups.filter(g => !g.retired || g.id === u.group_id)).forEach(g => {
          const o = document.createElement('option');
          o.value = String(g.id);
          o.textContent = g.name + (g.retired ? ' (retired)' : '');
          if(String(u.group_id ?? '') === String(g.id)) o.selected = true;
          sel.appendChild(o);
        });
        sel.disabled = false;
      };
      if(adminGroupsCache) fill(adminGroupsCache);
      else apiGetMaktabGroups().then(g => { adminGroupsCache = g; fill(g); }).catch(() => {});
    }
  });
}

document.getElementById('admin_search').addEventListener('input', renderAdminUsersList);
const adminAddRowBtnEl = document.getElementById('adminAddRowBtn');   // guarded: fixtures build only the markup they test
if(adminAddRowBtnEl) adminAddRowBtnEl.addEventListener('click', () => adminShowAddRow(true));

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
  // V3.78.0 (item 8): her group, assigned here (names are defined on
  // Maktab Settings). Loaded async after the card renders; the select
  // stays disabled until the list arrives.

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
    ${user.role === 'student' ? `<label>Group</label>
    <select id="uc_group" disabled><option>Loading…</option></select>` : ''}
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

  // V3.78.0: populate the group select — live groups plus, if she is in a
  // retired one, that group (kept selectable so Save doesn't silently move
  // her; the worker refuses ASSIGNING a retired group to someone new).
  if(user.role === 'student'){
    apiGetMaktabGroups().then(groups => {
      const sel = document.getElementById('uc_group');
      if(!sel) return;
      sel.innerHTML = '';
      const opts = [{ id: '', name: 'No group' }].concat(groups.filter(g => !g.retired || g.id === user.group_id));
      for(const g of opts){
        const o = document.createElement('option');
        o.value = String(g.id);
        o.textContent = g.name + (g.retired ? ' (retired)' : '');
        if(String(user.group_id ?? '') === String(g.id)) o.selected = true;
        sel.appendChild(o);
      }
      sel.disabled = false;
    }).catch(() => { /* the select stays disabled; nothing to save then */ });
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
      // V3.78.0: the group, only if the select loaded and the value changed
      const groupSel = document.getElementById('uc_group');
      if(groupSel && !groupSel.disabled && groupSel.value !== String(user.group_id ?? '')){
        fields.group_id = groupSel.value === '' ? null : Number(groupSel.value);
      }
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
  adminShowAddRow(false);   // V4.1.0: the add row closes; the new student appears in the table
  loadAdminUsers();
}
