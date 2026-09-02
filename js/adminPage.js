/* Hifzhelper build 4.2.6 | js/adminPage.js */
// ============================================================
// Hifzhelper — Admin screen
// Compact searchable list (ID / Name / Status) — selecting a row opens a
// detail card with every editable value (name, role, reset PIN, delete).
// Gated to role === 'admin' both here (nav entry only appears for admins)
// and server-side (every /admin/* endpoint 403s anyone else regardless).
// ============================================================

let adminUsers = [];

// V4.2.1 (user): "Register a user" sits ABOVE the table and opens the new
// user as its FIRST ROW — no separate register box any more.
function adminShowAddRow(show){
  adminAdding = !!show;
  if(!show) adminMatchedId = null;
  renderAdminUsersList();
}

async function renderAdminScreen(){
  // V4.2.1: the register controls are a table row that exists only while
  // open — nothing to clear here; opening fresh renders it empty.
  adminAdding = false;
  adminMatchedId = null;
  adminJustCreatedId = null;
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

// V4.2.1: one shared <colgroup> on BOTH the header table and the body
// table — two tables with identical column widths align exactly, which a
// flex header over a fixed-layout table never reliably did (V4.2.0's
// misaligned "TEACHER PROF"). Name takes the leftover width; the rest are
// honest fixed widths, so nothing truncates and delete stays visible.
// The Teacher-profile column is GONE (user, 2026-09-01: the Role select
// already promotes directly; the second-account path was redundant).
const ADMIN_COLGROUP = `<colgroup>
  <col style="width:110px"><col><col style="width:130px"><col style="width:125px">
  <col style="width:140px"><col style="width:110px"><col style="width:230px">
</colgroup>`;
let adminAdding = false;   // the "Register a user" row is open
// V4.2.1 (user): after registering, the NEW user is pinned to the TOP row
// and highlighted, so her role, group, copy and share are right there.
// Cleared when the screen is left or another user is registered.
let adminJustCreatedId = null;

function renderAdminUsersList(){
  const query = (document.getElementById('admin_search').value || '').trim().toLowerCase();
  let filtered = adminUsers.filter(u =>
    !query || u.id.toLowerCase().includes(query) || u.name.toLowerCase().includes(query)
  );
  if(adminJustCreatedId){
    const idx = filtered.findIndex(u => u.id === adminJustCreatedId);
    if(idx > 0) filtered = [filtered[idx]].concat(filtered.slice(0, idx), filtered.slice(idx + 1));
  }
  const list = document.getElementById('adminUsersList');
  const canShare = typeof navigator.share === 'function';
  const esc = (v) => String(v == null ? '' : v).replace(/"/g, '&quot;');

  list.innerHTML = `
    <table class="admin-table admin-table-head">${ADMIN_COLGROUP}<thead><tr>
      <th class="admin-th-id">Unique ID</th><th>Name</th><th>WhatsApp</th><th>Role</th>
      <th>Group</th><th>Status</th><th class="admin-th-actions">Actions</th>
    </tr></thead></table>
    <div class="admin-wrap"><table class="admin-table admin-table-body">${ADMIN_COLGROUP}<tbody></tbody></table></div>`;
  const tbody = list.querySelector('tbody');

  // ---- the REGISTER row: first in the table, opened by the button above ----
  if(adminAdding){
    const tr = document.createElement('tr');
    tr.className = 'admin-row admin-row-fields admin-row-new';
    tr.innerHTML = `
      <td class="mono admin-cell-id admin-dash" data-label="Unique ID">new</td>
      <td data-label="Name"><input type="text" class="admin-inline" id="admin_new_name" placeholder="Name"></td>
      <td data-label="WhatsApp"><input type="text" class="admin-inline" id="admin_new_whatsapp" placeholder="WhatsApp"></td>
      <td data-label="Role"><select class="admin-inline" id="admin_new_role">
        <option value="student" selected>Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option>
      </select></td>
      <td data-label="Group"><select class="admin-inline" id="admin_new_group" disabled><option value="">No group</option></select></td>
      <td data-label="Status"><span class="admin-dash">—</span></td>
      <td class="admin-actions-cell" data-label="Actions">
        <button type="button" class="secondary admin-register-btn" id="adminRegisterBtn">Register</button>
        <button type="button" class="icon-btn" id="adminRegisterCloseBtn" aria-label="Cancel">&times;</button>
      </td>`;
    tbody.appendChild(tr);
    const trMatch = document.createElement('tr');
    trMatch.className = 'admin-row admin-row-match hidden';
    trMatch.id = 'adminRegisterMatchRow';
    trMatch.innerHTML = `<td colspan="7">
      <div class="form-hint" id="adminRegisterMatchHint"></div>
      <div class="admin-match-actions">
        <button type="button" class="secondary" id="adminRegisterCancelBtn">Cancel</button>
        <button type="button" class="secondary" id="adminRegisterContinueBtn">Continue</button>
        <button type="button" class="secondary" id="adminRegisterResetPinBtn">Reset that student's PIN</button>
      </div>
      <div class="form-error" id="adminRegisterError"></div>
    </td>`;
    tbody.appendChild(trMatch);
    const trErr = document.createElement('tr');
    trErr.className = 'admin-row admin-row-newerr';
    trErr.innerHTML = `<td colspan="7"><div class="form-error" id="adminRegisterRowError"></div></td>`;
    tbody.appendChild(trErr);
    wireAdminRegisterRow();
    const gsel = tr.querySelector('#admin_new_group');
    const fillNew = (groups) => {
      gsel.innerHTML = '<option value="">No group</option>' + groups.filter(g => !g.retired).map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
      gsel.disabled = false;
    };
    if(adminGroupsCache) fillNew(adminGroupsCache);
    else apiGetMaktabGroups().then(g => { adminGroupsCache = g; fillNew(g); }).catch(() => {});
    setTimeout(() => tr.querySelector('#admin_new_name').focus(), 0);
  }

  if(!filtered.length && !adminAdding){
    tbody.innerHTML = '<tr><td colspan="7" class="admin-list-empty">No matching users.</td></tr>';
    return;
  }

  filtered.forEach(u => {
    const tr = document.createElement('tr');
    tr.className = 'admin-row admin-row-fields' + (u.id === adminJustCreatedId ? ' admin-row-just-created' : '');
    tr.innerHTML = `
      <td class="mono admin-cell-id" data-label="Unique ID">${u.id}</td>
      <td data-label="Name"><input type="text" class="admin-inline" data-f="name" value="${esc(u.name)}"></td>
      <td data-label="WhatsApp"><input type="text" class="admin-inline" data-f="whatsapp_number" value="${esc(u.whatsapp_number)}"></td>
      <td data-label="Role"><select class="admin-inline" data-f="role">
        <option value="student"${u.role === 'student' ? ' selected' : ''}>Student</option>
        <option value="teacher"${u.role === 'teacher' ? ' selected' : ''}>Teacher</option>
        <option value="admin"${u.role === 'admin' ? ' selected' : ''}>Admin</option>
      </select></td>
      <td data-label="Group">${u.role === 'student' ? '<select class="admin-inline" data-f="group_id" disabled><option>…</option></select>' : '<span class="admin-dash">—</span>'}</td>
      <td data-label="Status"><label class="admin-status"><input type="checkbox" class="admin-inline" data-f="active"${u.active ? ' checked' : ''}><span>${u.active ? 'Active' : 'Inactive'}</span></label></td>
      <td class="admin-actions-cell" data-label="Actions"></td>`;
    tbody.appendChild(tr);

    const actionsHtml = `
      <button type="button" class="icon-btn" data-copy-url="${u.id}" aria-label="Copy personal URL"></button>
      ${canShare ? `<button type="button" class="icon-btn" data-share-url="${u.id}" aria-label="Share personal URL"></button>` : ''}
      <button type="button" class="secondary admin-pin-btn" data-reset-pin>Reset PIN</button>
      <button type="button" class="icon-btn admin-delete-btn" data-delete aria-label="Delete user"></button>`;
    tr.querySelector('.admin-actions-cell').innerHTML = actionsHtml;
    const trActions = document.createElement('tr');
    trActions.className = 'admin-row admin-row-actions';
    trActions.innerHTML = `<td colspan="7"><div class="admin-actions-strip">${actionsHtml}</div></td>`;
    tbody.appendChild(trActions);

    const wire = (scope) => {
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
          catch(e){ adminFlash(e.message, true); }
        });
      }
    };
    wire(tr); wire(trActions);

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
const adminAddRowBtnEl = document.getElementById('adminRegisterOpenBtn');   // guarded: fixtures build only the markup they test
if(adminAddRowBtnEl) adminAddRowBtnEl.addEventListener('click', () => adminShowAddRow(true));

// V4.2.1: the per-user detail card (openUserCard) is REMOVED. The table
// does everything it did, and it was the last surface still offering
// teaching-profile creation after the user retired that path.
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

// V4.2.1: the register controls live in the table's FIRST ROW, opened by
// "Register a user" above the table. Wired per render (the row is rebuilt
// each time). Continue re-submits whatever the row CURRENTLY holds with
// force:true — the V3.4.2 semantics, unchanged.
function wireAdminRegisterRow(){
  document.getElementById('adminRegisterBtn').addEventListener('click', attemptAdminRegister);
  document.getElementById('adminRegisterCloseBtn').addEventListener('click', () => { adminAdding = false; adminMatchedId = null; renderAdminUsersList(); });
  document.getElementById('adminRegisterCancelBtn').addEventListener('click', cancelAdminMatch);
  document.getElementById('adminRegisterContinueBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('adminRegisterError');
    errEl.textContent = '';
    const name = document.getElementById('admin_new_name').value.trim();
    const whatsapp = document.getElementById('admin_new_whatsapp').value.trim();
    if(!name){ errEl.textContent = 'Enter a name.'; return; }
    try{
      const result = await apiAdminRegisterStudent(name, whatsapp || null, true);
      await finishAdminRegisterUI(result);
    } catch(e){ errEl.textContent = "Couldn't register: " + e.message; }
  });
  document.getElementById('adminRegisterResetPinBtn').addEventListener('click', async () => {
    if(!adminMatchedId) return;
    if(!confirm(`Reset the PIN of the existing student ${adminMatchedId}? They'll set a new one on their next login.`)) return;
    try{ await apiAdminResetPin(adminMatchedId); adminFlash(`PIN reset for ${adminMatchedId}.`); cancelAdminMatch(); }
    catch(e){ document.getElementById('adminRegisterError').textContent = "Couldn't reset PIN: " + e.message; }
  });
}

async function attemptAdminRegister(){
  const errEl = document.getElementById('adminRegisterRowError');
  errEl.textContent = '';
  const name = document.getElementById('admin_new_name').value.trim();
  const whatsapp = document.getElementById('admin_new_whatsapp').value.trim();
  if(!name){ errEl.textContent = 'Enter a name.'; return; }
  try{
    const result = await apiAdminRegisterStudent(name, whatsapp || null, false);
    if(result.matched){
      adminMatchedId = result.matchedId;
      // V3.4.3 item 5: names the actual matched student — the list can
      // hold several similarly-named entries.
      document.getElementById('adminRegisterMatchHint').textContent =
        `Student: ${name}, WhatsApp number: ${whatsapp || '(none given)'} has the same details and is currently ${result.matchedActive ? 'active' : 'inactive'}. How do you want to proceed?`;
      document.getElementById('adminRegisterMatchRow').classList.remove('hidden');
    } else {
      await finishAdminRegisterUI(result);
    }
  } catch(e){
    errEl.textContent = "Couldn't register: " + e.message;
  }
}

function cancelAdminMatch(){
  adminMatchedId = null;
  const row = document.getElementById('adminRegisterMatchRow');
  if(row) row.classList.add('hidden');
  const err = document.getElementById('adminRegisterError');
  if(err) err.textContent = '';
}

// After the account exists, apply the row's ROLE and GROUP — the register
// endpoint creates a student, so these are the two follow-ups — then
// close the row; the new user appears in the table.
async function finishAdminRegisterUI(result){
  const roleEl = document.getElementById('admin_new_role');
  const groupEl = document.getElementById('admin_new_group');
  const role = roleEl ? roleEl.value : 'student';
  const group = groupEl && !groupEl.disabled && groupEl.value !== '' ? Number(groupEl.value) : null;
  try{
    if(role !== 'student') await apiAdminChangeRole(result.id, role);
    if(group != null && role === 'student') await apiAdminUpdateUser(result.id, { group_id: group });
  } catch(e){
    adminFlash(`Registered ${result.id}, but couldn't apply ${role !== 'student' ? 'the role' : 'the group'}: ${e.message}`, true);
  }
  adminMatchedId = null;
  adminAdding = false;
  adminJustCreatedId = result.id;   // V4.2.1: pinned to the top row, highlighted
  adminFlash(`Created — ID: ${result.id}. Share it with ${result.name} for their first login.`);
  await loadAdminUsers();
}
