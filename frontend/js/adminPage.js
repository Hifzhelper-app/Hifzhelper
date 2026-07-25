// ============================================================
// Hifzhelper — Admin screen
// User list with reset-PIN / change-role actions per row, plus a
// register-new-student form. Gated to role === 'admin' both here (the
// nav entry only appears for admins) and server-side (every /admin/*
// endpoint 403s anyone else regardless).
// ============================================================

let adminUsers = [];

async function renderAdminScreen(){
  document.getElementById('adminRegisterError').textContent = '';
  document.getElementById('adminRegisterResult').textContent = '';
  document.getElementById('admin_new_name').value = '';
  await loadAdminUsers();
}

async function loadAdminUsers(){
  const tbody = document.getElementById('adminUsersTbody');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-ink-faint);padding:16px;">Loading…</td></tr>`;
  try{
    adminUsers = await apiAdminListUsers();
    renderAdminUsersTable();
  } catch(e){
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-error);padding:16px;">Couldn't load: ${e.message}</td></tr>`;
  }
}

function renderAdminUsersTable(){
  const tbody = document.getElementById('adminUsersTbody');
  tbody.innerHTML = adminUsers.map(u => `
    <tr>
      <td class="mono">${u.id}</td>
      <td>${u.name}</td>
      <td>
        <select data-role-for="${u.id}">
          <option value="student" ${u.role==='student'?'selected':''}>Student</option>
          <option value="teacher" ${u.role==='teacher'?'selected':''}>Teacher</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
        </select>
      </td>
      <td>${u.active ? 'Active' : 'Inactive'}</td>
      <td><button class="secondary" data-reset-for="${u.id}">Reset PIN</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-role-for]').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.roleFor;
      const newRole = sel.value;
      if(!confirm(`Change ${id}'s role to "${newRole}"?`)){
        renderAdminUsersTable(); // revert the dropdown visually
        return;
      }
      try{
        await apiAdminChangeRole(id, newRole);
        await loadAdminUsers();
      } catch(e){
        showBanner("Couldn't change role: " + e.message);
        await loadAdminUsers();
      }
    });
  });

  tbody.querySelectorAll('[data-reset-for]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.resetFor;
      if(!confirm(`Reset ${id}'s PIN? They'll set a new one on their next login.`)) return;
      try{
        await apiAdminResetPin(id);
        showBanner(`PIN reset for ${id} — they can log in with any new 4-digit PIN next time.`);
      } catch(e){
        showBanner("Couldn't reset PIN: " + e.message);
      }
    });
  });
}

document.getElementById('adminRegisterBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('adminRegisterError');
  const resultEl = document.getElementById('adminRegisterResult');
  errEl.textContent = '';
  resultEl.textContent = '';
  const name = document.getElementById('admin_new_name').value.trim();
  if(!name){ errEl.textContent = 'Enter a name.'; return; }

  try{
    const result = await apiAdminRegisterStudent(name);
    resultEl.textContent = `Created — ID: ${result.id}. Share this with ${result.name} so they can log in for the first time.`;
    document.getElementById('admin_new_name').value = '';
    await loadAdminUsers();
  } catch(e){
    errEl.textContent = "Couldn't register: " + e.message;
  }
});
