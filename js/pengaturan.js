/* ============================================================
 * Pengaturan Akun — khusus admin.
 * - Kartu "Akun Saya": info + ganti password sendiri.
 * - Kartu "Kelola Pengguna": tambah / edit / nonaktif / hapus /
 *   reset password pengguna kasir & admin.
 * ============================================================ */

var editingUserId = null;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function initPengaturan() {
  renderPengaturan();
}

function renderPengaturan() {
  var me = Auth.current();
  if (!me || me.role !== 'admin') return;
  // --- Akun saya ---
  document.getElementById('pgMyNama').textContent = me.nama;
  document.getElementById('pgMyUsername').textContent = '@' + me.username;
  document.getElementById('pgMyRole').textContent = Auth.roleLabel(me.role);
  document.getElementById('pgMyAvatar').textContent = (me.nama || 'A').trim().charAt(0).toUpperCase();
  // --- Tabel pengguna ---
  var users = Auth.getUsers().slice().sort(function (a, b) {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
    return a.nama.localeCompare(b.nama);
  });
  var tb = document.getElementById('pgUserRows');
  tb.innerHTML = users.map(function (u) {
    var isSelf = u.id === me.id;
    var roleBadge = u.role === 'admin'
      ? '<span class="badge">Admin</span>'
      : '<span class="badge-green">Kasir</span>';
    var statusBadge = u.aktif
      ? '<span class="badge-green">Aktif</span>'
      : '<span class="badge-red">Nonaktif</span>';
    return '<tr>' +
      '<td class="font-semibold">' + esc(u.nama) + (isSelf ? ' <span class="text-[10px] text-slate-400">(Anda)</span>' : '') + '</td>' +
      '<td class="font-mono text-xs">@' + esc(u.username) + '</td>' +
      '<td>' + roleBadge + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td class="whitespace-nowrap">' +
        '<button onclick="openUserForm(\'' + u.id + '\')" class="text-xs text-blue-600 hover:underline mr-2">✏️ Edit</button>' +
        '<button onclick="toggleUserActive(\'' + u.id + '\')" class="text-xs text-amber-600 hover:underline mr-2">' + (u.aktif ? 'Nonaktifkan' : 'Aktifkan') + '</button>' +
        '<button onclick="resetUserPassword(\'' + u.id + '\')" class="text-xs text-slate-500 hover:underline mr-2">Reset PW</button>' +
        '<button onclick="deleteUserAccount(\'' + u.id + '\')" class="text-xs text-red-500 hover:underline">🗑️</button>' +
      '</td></tr>';
  }).join('');
}

/* ---------- Form tambah / edit ---------- */

function openUserForm(id) {
  editingUserId = id || null;
  var users = Auth.getUsers();
  var u = id ? users.find(function (x) { return x.id === id; }) : null;
  document.getElementById('ufTitle').textContent = u ? 'Edit Pengguna' : 'Tambah Pengguna';
  document.getElementById('ufNama').value = u ? u.nama : '';
  document.getElementById('ufUsername').value = u ? u.username : '';
  document.getElementById('ufPassword').value = '';
  document.getElementById('ufPassword').placeholder = u ? '(kosongkan bila tidak diubah)' : 'Min. 6 karakter';
  document.getElementById('ufRole').value = u ? u.role : 'kasir';
  document.getElementById('pgUserForm').classList.remove('hidden');
  document.getElementById('ufNama').focus();
}

function closeUserForm() {
  editingUserId = null;
  document.getElementById('pgUserForm').classList.add('hidden');
}

async function saveUserForm() {
  var me = Auth.current();
  var nama = document.getElementById('ufNama').value;
  var username = document.getElementById('ufUsername').value;
  var password = document.getElementById('ufPassword').value;
  var role = document.getElementById('ufRole').value;
  var res;
  if (editingUserId) {
    res = Auth.updateUser(me, editingUserId, { nama: nama, username: username, role: role });
    if (res.ok && password) {
      res = await Auth.setPassword(me, editingUserId, password);
    }
  } else {
    res = await Auth.createUser(me, { nama: nama, username: username, password: password, role: role });
  }
  if (!res.ok) { toast(res.error, 'error'); return; }
  closeUserForm();
  renderPengaturan();
  if (typeof applySessionUI === 'function') applySessionUI();
  toast('Pengguna tersimpan ✓');
}

/* ---------- Aksi baris ---------- */

function toggleUserActive(id) {
  var me = Auth.current();
  var u = Auth.getUsers().find(function (x) { return x.id === id; });
  if (!u) return;
  var res = Auth.updateUser(me, id, { aktif: !u.aktif });
  if (!res.ok) { toast(res.error, 'error'); return; }
  renderPengaturan();
  if (typeof applySessionUI === 'function') applySessionUI();
  toast(u.aktif ? 'Pengguna dinonaktifkan.' : 'Pengguna diaktifkan ✓');
}

async function deleteUserAccount(id) {
  var me = Auth.current();
  var u = Auth.getUsers().find(function (x) { return x.id === id; });
  var ok = await UI.confirm({
    title: 'Hapus pengguna?',
    message: '"' + (u ? u.nama : id) + '" (@' + (u ? u.username : '?') + ') akan dihapus permanen dan tak bisa login lagi.',
    confirmText: 'Ya, hapus',
    tone: 'danger'
  });
  if (!ok) return;
  var res = Auth.deleteUser(me, id);
  if (!res.ok) { toast(res.error, 'error'); return; }
  renderPengaturan();
  toast('Pengguna dihapus.');
}

async function resetUserPassword(id) {
  var me = Auth.current();
  var u = Auth.getUsers().find(function (x) { return x.id === id; });
  var ok = await UI.confirm({
    title: 'Reset password?',
    message: 'Password "' + (u ? u.nama : id) + '" akan direset ke 123456. Minta ia segera menggantinya.',
    confirmText: 'Ya, reset',
    tone: 'danger'
  });
  if (!ok) return;
  var res = await Auth.setPassword(me, id, '123456');
  if (!res.ok) { toast(res.error, 'error'); return; }
  toast('Password direset ke 123456 ✓');
}

/* ---------- Ganti password sendiri ---------- */

async function saveOwnPassword() {
  var me = Auth.current();
  if (!me) return;
  var lama = document.getElementById('pgOldPw').value;
  var baru = document.getElementById('pgNewPw').value;
  var konf = document.getElementById('pgNewPw2').value;
  if (!lama || !baru) { toast('Isi password lama & baru (wajib).', 'error'); return; }
  if (baru !== konf) { toast('Konfirmasi password baru tidak sama.', 'error'); return; }
  var res = await Auth.changeOwnPassword(me.id, lama, baru);
  if (!res.ok) { toast(res.error, 'error'); return; }
  document.getElementById('pgOldPw').value = '';
  document.getElementById('pgNewPw').value = '';
  document.getElementById('pgNewPw2').value = '';
  toast('Password Anda diganti ✓');
}
