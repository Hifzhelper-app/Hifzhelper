/* Hifzhelper build 4.2.15.4 | js/adminPage.js */
// ============================================================
// Hifzhelper — Admin screen
// Compact searchable list (ID / Name / Status) — selecting a row opens a
// detail card with every editable value (name, role, reset PIN, delete).
// Gated to role === 'admin' both here (nav entry only appears for admins)
// and server-side (every /admin/* endpoint 403s anyone else regardless).
// ============================================================

let adminUsers = [];

// V4.2.9.2: registration becomes a purpose-built card on phone width only.
// Desktop/tablet retain the existing inline table row.
function adminIsMobile(){
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 767px)').matches
    : false;
}

// V4.2.1 (user): "Register a user" sits ABOVE the table and opens the new
// user as its FIRST ROW — no separate register box any more.
function adminShowAddRow(show){
  adminAdding = !!show;
  if(show) adminNewHaidhRuling = 'hanafi';
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
  <col style="width:140px"><col style="width:110px"><col style="width:105px"><col style="width:230px">
</colgroup>`;
let adminAdding = false;   // the "Register a user" row is open
// V4.2.1 (user): after registering, the NEW user is pinned to the TOP row
// and highlighted, so her role, group, copy and share are right there.
// Cleared when the screen is left or another user is registered.
let adminJustCreatedId = null;
// V4.2.15.1: the registration-only Haidh setup mirrors the PJ Setup ruling switch.
let adminNewHaidhRuling = 'hanafi';

function adminHaidhSetupComplete(user){
  return !!(user && user.role === 'student' && user.track_haidh && user.haidh_cycle_length && user.haidh_period_length && user.haidh_next_expected);
}

function adminOpenHaidhSettings(user){
  if(!user || user.role !== 'student') return;
  let ruling = user.haidh_ruling || 'hanafi';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay admin-haidh-settings-modal';
  overlay.innerHTML = `<div class="modal-card admin-haidh-settings-card" role="dialog" aria-modal="true" aria-label="Haidh settings for ${String(user.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}">
    <div class="admin-haidh-settings-head"><span class="admin-haidh-settings-titles"><strong>Haaidha</strong><strong class="admin-haidh-settings-student">${String(user.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</strong></span><span class="admin-haidh-settings-actions"><button type="button" class="icon-btn admin-haidh-settings-save" id="adminEditHaidhSave" aria-label="Save Haidh settings" title="Save">${iconHtml('save')}</button><button type="button" class="close-btn admin-haidh-settings-close" id="adminEditHaidhClose" aria-label="Close">&times;</button></span></div>
    ${adminRegistrationHaidhSetupMarkup('admin_edit', { open:true, showTitle:false, cycle:user.haidh_cycle_length || '', period:user.haidh_period_length || '', next:user.haidh_next_expected || '' })}
    <div class="form-error" id="adminEditHaidhError"></div>
  </div>`;
  document.body.appendChild(overlay);
  renderSwitch('admin_edit_haidh_ruling_switch', ruling);
  wireSwitch('admin_edit_haidh_ruling_switch', value => { ruling = value; renderSwitch('admin_edit_haidh_ruling_switch', ruling); });
  const close = () => overlay.remove();
  document.getElementById('adminEditHaidhClose').addEventListener('click', close);
  overlay.addEventListener('click', e => { if(e.target === overlay) close(); });
  document.getElementById('adminEditHaidhSave').addEventListener('click', async () => {
    const err = document.getElementById('adminEditHaidhError'); err.textContent = '';
    const cycle = parseInt(document.getElementById('admin_edit_haidh_cycle_length').value, 10);
    const period = parseInt(document.getElementById('admin_edit_haidh_period_length').value, 10);
    const next = document.getElementById('admin_edit_haidh_next_expected').value;
    const profile = { track_haidh:true, haidh_ruling:ruling, haidh_cycle_length:cycle, haidh_period_length:period, haidh_next_expected:next };
    const problem = adminRegistrationProfileError(profile);
    if(problem){ err.textContent = problem; return; }
    const save = document.getElementById('adminEditHaidhSave'); save.disabled = true;
    try{
      await apiAdminUpdateUser(user.id, Object.assign({ gender:'F' }, profile));
      close();
      adminFlash('Haidh settings saved');
      await loadAdminUsers();
    } catch(e){ err.textContent = "Couldn't save: " + e.message; save.disabled = false; }
  });
}

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

  const mobileRegister = adminAdding && adminIsMobile() ? `
    <div class="admin-mobile-register-card" id="adminMobileRegisterCard">
      <div class="admin-mobile-register-heading">
        <strong>Register a student</strong>
        <button type="button" class="icon-btn" id="adminRegisterCloseBtn" aria-label="Cancel">&times;</button>
      </div>
      <div class="admin-mobile-register-inputs">
        <label><span>Name</span><input type="text" class="admin-inline" id="admin_new_name" placeholder="Name"></label>
        <label><span>WhatsApp</span><input type="text" class="admin-inline" id="admin_new_whatsapp" placeholder="WhatsApp number"></label>
      </div>
      <div class="admin-mobile-register-options">
        <label><span>Role</span><select class="admin-inline" id="admin_new_role">
          <option value="student" selected>Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option>
        </select></label>
        <label><span>Group</span><select class="admin-inline" id="admin_new_group" disabled><option value="">None</option></select></label>
        <label><span>Status</span><span class="admin-status admin-mobile-new-status"><input type="checkbox" class="admin-inline" id="admin_new_active" checked><span>Active</span></span></label>
      </div>
      <div class="admin-mobile-register-profile">
        <label class="admin-register-check"><input type="checkbox" id="admin_new_female"><span>Female</span></label>
        <label class="admin-register-check admin-register-haidh-check hidden" id="admin_new_haidh_wrap"><span>Haaidha</span><input type="checkbox" id="admin_new_haidh"></label>
      </div>
      ${adminRegistrationHaidhSetupMarkup()}
      <div class="admin-mobile-register-actions"><button type="button" class="secondary admin-register-btn" id="adminRegisterBtn">Register</button></div>
      <div class="admin-mobile-register-match hidden" id="adminRegisterMatchRow">
        <div class="form-hint" id="adminRegisterMatchHint"></div>
        <div class="admin-match-actions">
          <button type="button" class="secondary" id="adminRegisterCancelBtn">Cancel</button>
          <button type="button" class="secondary" id="adminRegisterContinueBtn">Continue</button>
          <button type="button" class="secondary" id="adminRegisterResetPinBtn">Reset that student's PIN</button>
        </div>
        <div class="form-error" id="adminRegisterError"></div>
      </div>
      <div class="form-error" id="adminRegisterRowError"></div>
    </div>` : '';
  list.innerHTML = `${mobileRegister}
    <table class="admin-table admin-table-head">${ADMIN_COLGROUP}<thead><tr>
      <th class="admin-th-id">Unique ID</th><th>Name</th><th>WhatsApp</th><th>Role</th>
      <th>Group</th><th>Status</th><th>Haidh Settings</th><th class="admin-th-actions">Actions</th>
    </tr></thead></table>
    <div class="admin-wrap"><table class="admin-table admin-table-body">${ADMIN_COLGROUP}<tbody></tbody></table></div>`;
  const tbody = list.querySelector('tbody');

  // ---- registration: purpose-built card on mobile; original row on desktop ----
  if(adminAdding){
    if(!adminIsMobile()){
      const tr = document.createElement('tr');
      tr.className = 'admin-row admin-row-fields admin-row-new';
      tr.innerHTML = `
        <td class="mono admin-cell-id admin-dash" data-label="Unique ID">new</td>
        <td data-label="Name"><input type="text" class="admin-inline" id="admin_new_name" placeholder="Name"></td>
        <td data-label="WhatsApp"><input type="text" class="admin-inline" id="admin_new_whatsapp" placeholder="WhatsApp"></td>
        <td data-label="Role"><select class="admin-inline" id="admin_new_role">
          <option value="student" selected>Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option>
        </select></td>
        <td data-label="Group"><select class="admin-inline" id="admin_new_group" disabled><option value="">None</option></select></td>
        <td data-label="Status"><span class="admin-new-profile-inline">
          <label class="admin-register-check"><input type="checkbox" id="admin_new_female"><span>Female</span></label>
          <label class="admin-register-check admin-register-haidh-check hidden" id="admin_new_haidh_wrap"><span>Haaidha</span><input type="checkbox" id="admin_new_haidh"></label>
        </span></td>
        <td data-label="Haidh Settings"><span class="admin-dash">—</span></td>
        <td class="admin-actions-cell" data-label="Actions">
          <button type="button" class="secondary admin-register-btn" id="adminRegisterBtn">Register</button>
          <button type="button" class="icon-btn" id="adminRegisterCloseBtn" aria-label="Cancel">&times;</button>
        </td>`;
      tbody.appendChild(tr);
      const trHaidh = document.createElement('tr');
      trHaidh.className = 'admin-row admin-row-new-haidh hidden';
      trHaidh.id = 'adminNewHaidhSetupRow';
      trHaidh.innerHTML = `<td colspan="8">${adminRegistrationHaidhSetupMarkup()}</td>`;
      tbody.appendChild(trHaidh);
      const trMatch = document.createElement('tr');
      trMatch.className = 'admin-row admin-row-match hidden';
      trMatch.id = 'adminRegisterMatchRow';
      trMatch.innerHTML = `<td colspan="8">
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
      trErr.innerHTML = `<td colspan="8"><div class="form-error" id="adminRegisterRowError"></div></td>`;
      tbody.appendChild(trErr);
    }
    wireAdminRegisterRow();
    const gsel = document.getElementById('admin_new_group');
    const fillNew = (groups) => {
      if(!gsel) return;
      gsel.innerHTML = '<option value="">None</option>' + groups.filter(g => !g.retired).map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
      gsel.disabled = false;
    };
    if(adminGroupsCache) fillNew(adminGroupsCache);
    else apiGetMaktabGroups().then(g => { adminGroupsCache = g; fillNew(g); }).catch(() => {});
    setTimeout(() => { const el = document.getElementById('admin_new_name'); if(el) el.focus(); }, 0);
  }

  if(!filtered.length && !adminAdding){
    tbody.innerHTML = '<tr><td colspan="8" class="admin-list-empty">No matching users.</td></tr>';
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
      <td data-label="Haidh Settings">${u.role === 'student' ? `<button type="button" class="admin-haidh-pill${adminHaidhSetupComplete(u) ? ' is-complete' : ''}" data-haidh-settings="${u.id}">Haidh</button>` : '<span class="admin-dash">—</span>'}</td>
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
    trActions.innerHTML = `<td colspan="8"><div class="admin-actions-strip">${actionsHtml}</div></td>`;
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
      const haidhBtn = scope.querySelector('[data-haidh-settings]');
      if(haidhBtn) haidhBtn.addEventListener('click', () => adminOpenHaidhSettings(u));
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
        [{ id: '', name: 'None' }].concat(groups.filter(g => !g.retired || g.id === u.group_id)).forEach(g => {
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
function adminRegistrationHaidhSetupMarkup(prefix, options){
  // V4.2.15.2: this is deliberately the ONE Haidh-settings component for
  // both registration and the Student Management Haidh pill. The caller
  // supplies only an id prefix / current values; labels, ruling switch and
  // control layout stay identical.
  const idp = prefix || 'admin_new';
  const opts = options || {};
  const hidden = opts.open ? '' : ' hidden';
  const title = opts.showTitle === false ? '' : '<div class="admin-register-haidh-title"><strong>Haidh setup</strong></div>';
  const cycle = opts.cycle == null ? '' : String(opts.cycle);
  const period = opts.period == null ? '' : String(opts.period);
  const next = opts.next == null ? '' : String(opts.next);
  return `<div class="admin-register-haidh-setup${hidden}" id="${idp}_haidh_setup">
    ${title}
    <div class="haidh-ruling-row">
      <div class="switch-track" id="${idp}_haidh_ruling_switch">
        <div class="switch-thumb"></div>
        <button type="button" class="switch-option" data-value="hanafi">Hanafi</button>
        <button type="button" class="switch-option" data-value="shafii">Shafi'i</button>
      </div>
    </div>
    <p class="form-hint" style="margin-top:0;">Plans will be adjusted for haidh days. Can be adjusted for actual haidh at any time.</p>
    <div class="settings-row"><label>Haidh cycle frequency (days)</label><input type="number" inputmode="numeric" id="${idp}_haidh_cycle_length" min="1" value="${cycle}"></div>
    <div class="settings-row"><label>How many haidh days per cycle</label><input type="number" inputmode="numeric" id="${idp}_haidh_period_length" min="1" value="${period}"></div>
    <div class="settings-row"><label>Next expected haidh day</label><input type="date" id="${idp}_haidh_next_expected" value="${next}"></div>
  </div>`;
}

function adminRegistrationProfileValues(){
  const femaleEl = document.getElementById('admin_new_female');
  const haidhEl = document.getElementById('admin_new_haidh');
  const female = !!(femaleEl && femaleEl.checked);
  const trackHaidh = !!(female && haidhEl && haidhEl.checked);
  const cycleEl = document.getElementById('admin_new_haidh_cycle_length');
  const periodEl = document.getElementById('admin_new_haidh_period_length');
  const nextEl = document.getElementById('admin_new_haidh_next_expected');
  return {
    gender: female ? 'F' : 'M',
    track_haidh: trackHaidh,
    haidh_ruling: trackHaidh ? adminNewHaidhRuling : null,
    haidh_cycle_length: trackHaidh && cycleEl && cycleEl.value ? parseInt(cycleEl.value, 10) : null,
    haidh_period_length: trackHaidh && periodEl && periodEl.value ? parseInt(periodEl.value, 10) : null,
    haidh_next_expected: trackHaidh && nextEl ? nextEl.value : null
  };
}

function adminRegistrationProfileError(profile){
  if(!profile.track_haidh) return '';
  if(!profile.haidh_cycle_length || !profile.haidh_period_length || !profile.haidh_next_expected){
    return 'Please fill in Haidh cycle frequency, duration, and next expected day.';
  }
  const maxDuration = haidhOfficialMaxDuration(profile.haidh_ruling || 'hanafi');
  if(profile.haidh_period_length > maxDuration){
    return `Duration cannot exceed ${maxDuration} days for the selected ruling.`;
  }
  const minFrequency = haidhMinCycleFrequency(profile.haidh_period_length);
  if(profile.haidh_cycle_length < minFrequency){
    return `Haidh cycle frequency must be at least ${minFrequency} days for a ${profile.haidh_period_length}-day duration.`;
  }
  return '';
}

function wireAdminRegistrationProfile(){
  const femaleEl = document.getElementById('admin_new_female');
  const haidhEl = document.getElementById('admin_new_haidh');
  const wrap = document.getElementById('admin_new_haidh_wrap');
  const setup = document.getElementById('admin_new_haidh_setup');
  const setupRow = document.getElementById('adminNewHaidhSetupRow');
  if(!femaleEl || !haidhEl || !wrap || !setup) return;

  adminNewHaidhRuling = 'hanafi';
  renderSwitch('admin_new_haidh_ruling_switch', adminNewHaidhRuling);
  wireSwitch('admin_new_haidh_ruling_switch', (value) => {
    adminNewHaidhRuling = value;
    renderSwitch('admin_new_haidh_ruling_switch', adminNewHaidhRuling);
  });

  const sync = () => {
    const female = femaleEl.checked;
    if(!female) haidhEl.checked = false;
    wrap.classList.toggle('hidden', !female);
    const open = female && haidhEl.checked;
    setup.classList.toggle('hidden', !open);
    if(setupRow) setupRow.classList.toggle('hidden', !open);
  };
  femaleEl.addEventListener('change', sync);
  haidhEl.addEventListener('change', sync);
  sync();
}

function wireAdminRegisterRow(){
  wireAdminRegistrationProfile();
  document.getElementById('adminRegisterBtn').addEventListener('click', attemptAdminRegister);
  document.getElementById('adminRegisterCloseBtn').addEventListener('click', () => { adminAdding = false; adminMatchedId = null; renderAdminUsersList(); });
  document.getElementById('adminRegisterCancelBtn').addEventListener('click', cancelAdminMatch);
  document.getElementById('adminRegisterContinueBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('adminRegisterError');
    errEl.textContent = '';
    const name = document.getElementById('admin_new_name').value.trim();
    const whatsapp = document.getElementById('admin_new_whatsapp').value.trim();
    if(!name){ errEl.textContent = 'Enter a name.'; return; }
    const profile = adminRegistrationProfileValues();
    const profileError = adminRegistrationProfileError(profile);
    if(profileError){ errEl.textContent = profileError; return; }
    try{
      const result = await apiAdminRegisterStudent(name, whatsapp || null, true, profile);
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
  const profile = adminRegistrationProfileValues();
  const profileError = adminRegistrationProfileError(profile);
  if(profileError){ errEl.textContent = profileError; return; }
  try{
    const result = await apiAdminRegisterStudent(name, whatsapp || null, false, profile);
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
  const activeEl = document.getElementById('admin_new_active');
  const role = roleEl ? roleEl.value : 'student';
  const group = groupEl && !groupEl.disabled && groupEl.value !== '' ? Number(groupEl.value) : null;
  const active = activeEl ? activeEl.checked : true; // mobile card only; desktop remains active-by-default
  try{
    if(role !== 'student') await apiAdminChangeRole(result.id, role);
    const fields = {};
    if(group != null && role === 'student') fields.group_id = group;
    if(!active) fields.active = false;
    if(Object.keys(fields).length) await apiAdminUpdateUser(result.id, fields);
  } catch(e){
    adminFlash(`Registered ${result.id}, but couldn't apply all selected settings: ${e.message}`, true);
  }
  adminMatchedId = null;
  adminAdding = false;
  adminJustCreatedId = result.id;   // V4.2.1: pinned to the top row, highlighted
  if(adminIsMobile()){
    const search = document.getElementById('admin_search');
    if(search) search.value = ''; // V4.2.9.2: ensure the just-created card is immediately visible for Copy/Share
  }
  adminFlash(`Created — ID: ${result.id}. Share it with ${result.name} for their first login.`);
  await loadAdminUsers();
}
