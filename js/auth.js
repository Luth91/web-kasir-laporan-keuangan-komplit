/* ============================================================
 * Auth — login, sesi & hak akses (tanpa bawaan browser prompt)
 * - User tersimpan di LocalStorage key `pos_users` (password HASH,
 *   bukan plaintext). Sesi di sessionStorage (hangus saat tab ditutup).
 * - Role: 'admin' (Pembelian, Stok, Keuangan, Laporan, Pengaturan)
 *         'kasir' (Kasir saja)
 * - Modul ini murni logika (tanpa DOM) agar mudah diuji.
 * ============================================================ */
var Auth = (function () {
  'use strict';

  var USERS_KEY = 'pos_users';
  var SESSION_KEY = 'pos_session';

  var ROLE_PAGES = {
    kasir: ['kasir'],
    admin: ['pembelian', 'stok', 'keuangan', 'laporan', 'pengaturan']
  };
  var DEFAULT_PAGE = { kasir: 'kasir', admin: 'laporan' };
  var ROLE_LABEL = { admin: 'Admin', kasir: 'Kasir' };

  /* ---------- Hashing password ---------- */

  function randomSalt() {
    var arr = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
    } else {
      for (var i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.prototype.map.call(arr, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  function bytesToHex(bytes) {
    return Array.prototype.map.call(bytes, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  // Fallback murni-JS (cyrb53 + stretching) bila crypto.subtle tak tersedia
  function fallbackHash(password, salt) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    var str = salt + '::' + password;
    for (var round = 0; round < 200; round++) {
      for (var i = 0; i < str.length; i++) {
        var ch = str.charCodeAt(i) + round;
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    }
    return Promise.resolve('fb$' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16));
  }

  function subtleAvailable() {
    try {
      return typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function';
    } catch (e) { return false; }
  }

  // Selalu async agar pemanggil tak perlu peduli algoritma yg dipakai
  function hashPassword(password, salt) {
    salt = salt || randomSalt();
    if (subtleAvailable()) {
      var data = new TextEncoder().encode(salt + '::' + password);
      return crypto.subtle.digest('SHA-256', data).then(function (buf) {
        return { salt: salt, hash: bytesToHex(new Uint8Array(buf)), algo: 'sha256' };
      }).catch(function () {
        return fallbackHash(password, salt).then(function (h) {
          return { salt: salt, hash: h, algo: 'fallback' };
        });
      });
    }
    return fallbackHash(password, salt).then(function (h) {
      return { salt: salt, hash: h, algo: 'fallback' };
    });
  }

  function verifyPassword(password, rec) {
    if (!rec || !rec.salt || !rec.hash) return Promise.resolve(false);
    if (rec.algo === 'sha256' && subtleAvailable()) {
      var data = new TextEncoder().encode(rec.salt + '::' + password);
      return crypto.subtle.digest('SHA-256', data).then(function (buf) {
        return bytesToHex(new Uint8Array(buf)) === rec.hash;
      }).catch(function () { return false; });
    }
    if (rec.algo === 'fallback' || !rec.algo) {
      return fallbackHash(password, rec.salt).then(function (h) { return h === rec.hash; });
    }
    return Promise.resolve(false);
  }

  /* ---------- Penyimpanan user ---------- */

  function getUsers() { return POSStore.load(USERS_KEY, []); }
  function setUsers(list) { POSStore.save(USERS_KEY, list); }

  function publicUser(u) {
    if (!u) return null;
    return { id: u.id, nama: u.nama, username: u.username, role: u.role, aktif: u.aktif !== false };
  }

  function findByUsername(username) {
    var key = String(username || '').trim().toLowerCase();
    return getUsers().find(function (u) { return u.username.toLowerCase() === key; }) || null;
  }

  function validUsername(username) {
    return /^[a-zA-Z0-9._-]{3,20}$/.test(String(username || '').trim());
  }

  function seedUsers() {
    if (getUsers().length) return Promise.resolve(false);
    var now = new Date().toISOString();
    return Promise.all([
      hashPassword('admin123'),
      hashPassword('kasir123')
    ]).then(function (pw) {
      setUsers([
        { id: POSStore.uid('USR'), nama: 'Administrator', username: 'admin', role: 'admin', aktif: true, pass: pw[0], dibuatPada: now },
        { id: POSStore.uid('USR'), nama: 'Kasir 1', username: 'kasir', role: 'kasir', aktif: true, pass: pw[1], dibuatPada: now }
      ]);
      return true;
    });
  }

  /* ---------- Sesi ---------- */

  function sessStore() {
    try { return window.sessionStorage; } catch (e) { return null; }
  }

  function setSession(userId) {
    var s = sessStore();
    if (s) s.setItem(SESSION_KEY, JSON.stringify({ userId: userId, loginAt: new Date().toISOString() }));
  }

  function clearSession() {
    var s = sessStore();
    if (s) s.removeItem(SESSION_KEY);
  }

  function currentSession() {
    try {
      var s = sessStore();
      if (!s) return null;
      var raw = s.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function current() {
    var sess = currentSession();
    if (!sess) return null;
    var u = getUsers().find(function (x) { return x.id === sess.userId; });
    if (!u || u.aktif === false) return null;
    return publicUser(u);
  }

  /* ---------- Login / logout ---------- */

  function login(username, password) {
    var u = findByUsername(username);
    if (!u) return Promise.resolve({ ok: false, error: 'Username tidak ditemukan.' });
    if (u.aktif === false) return Promise.resolve({ ok: false, error: 'Akun dinonaktifkan. Hubungi admin.' });
    return verifyPassword(password || '', u.pass).then(function (match) {
      if (!match) return { ok: false, error: 'Password salah.' };
      setSession(u.id);
      return { ok: true, user: publicUser(u) };
    });
  }

  function logout() { clearSession(); }

  /* ---------- Hak akses ---------- */

  function pagesFor(role) { return (ROLE_PAGES[role] || []).slice(); }

  function can(userOrRole, page) {
    var role = typeof userOrRole === 'string' ? userOrRole : (userOrRole && userOrRole.role);
    return pagesFor(role).indexOf(page) !== -1;
  }

  function defaultPage(role) { return DEFAULT_PAGE[role] || 'kasir'; }

  /* ---------- CRUD pengguna (admin) ---------- */

  function assertAdmin(actor) {
    if (!actor || actor.role !== 'admin') return 'Hanya admin yang boleh mengelola akun.';
    return null;
  }

  function countActiveAdmins(exceptId) {
    return getUsers().filter(function (u) {
      return u.role === 'admin' && u.aktif !== false && u.id !== exceptId;
    }).length;
  }

  function createUser(actor, data) {
    var err = assertAdmin(actor);
    if (err) return Promise.resolve({ ok: false, error: err });
    var nama = String((data && data.nama) || '').trim();
    var username = String((data && data.username) || '').trim();
    var password = String((data && data.password) || '');
    var role = (data && data.role) === 'kasir' ? 'kasir' : 'admin';
    if (nama.length < 2) return Promise.resolve({ ok: false, error: 'Nama minimal 2 karakter.' });
    if (!validUsername(username)) return Promise.resolve({ ok: false, error: 'Username 3–20 karakter (huruf, angka, titik, _ , -).' });
    if (password.length < 6) return Promise.resolve({ ok: false, error: 'Password minimal 6 karakter.' });
    if (findByUsername(username)) return Promise.resolve({ ok: false, error: 'Username sudah dipakai.' });
    return hashPassword(password).then(function (pw) {
      var users = getUsers();
      var nu = { id: POSStore.uid('USR'), nama: nama, username: username, role: role, aktif: true, pass: pw, dibuatPada: new Date().toISOString() };
      users.push(nu);
      setUsers(users);
      return { ok: true, user: publicUser(nu) };
    });
  }

  function updateUser(actor, id, data) {
    var err = assertAdmin(actor);
    if (err) return { ok: false, error: err };
    var users = getUsers();
    var u = users.find(function (x) { return x.id === id; });
    if (!u) return { ok: false, error: 'Pengguna tidak ditemukan.' };
    if (data.nama !== undefined) {
      var nama = String(data.nama).trim();
      if (nama.length < 2) return { ok: false, error: 'Nama minimal 2 karakter.' };
      u.nama = nama;
    }
    if (data.username !== undefined) {
      var username = String(data.username).trim();
      if (!validUsername(username)) return { ok: false, error: 'Username 3–20 karakter (huruf, angka, titik, _ , -).' };
      var clash = users.find(function (x) { return x.id !== id && x.username.toLowerCase() === username.toLowerCase(); });
      if (clash) return { ok: false, error: 'Username sudah dipakai.' };
      u.username = username;
    }
    if (data.role !== undefined) {
      if (data.role !== 'admin' && data.role !== 'kasir') return { ok: false, error: 'Role tidak valid.' };
      if (u.role === 'admin' && data.role !== 'admin' && countActiveAdmins(u.id) === 0) {
        return { ok: false, error: 'Tidak bisa menurunkan role: ini satu-satunya admin aktif.' };
      }
      u.role = data.role;
    }
    if (data.aktif !== undefined) {
      if (u.id === actor.id && data.aktif === false) return { ok: false, error: 'Tidak bisa menonaktifkan akun sendiri.' };
      if (u.role === 'admin' && data.aktif === false && countActiveAdmins(u.id) === 0) {
        return { ok: false, error: 'Tidak bisa menonaktifkan satu-satunya admin aktif.' };
      }
      u.aktif = !!data.aktif;
    }
    setUsers(users);
    return { ok: true, user: publicUser(u) };
  }

  function deleteUser(actor, id) {
    var err = assertAdmin(actor);
    if (err) return { ok: false, error: err };
    var users = getUsers();
    var u = users.find(function (x) { return x.id === id; });
    if (!u) return { ok: false, error: 'Pengguna tidak ditemukan.' };
    if (u.id === actor.id) return { ok: false, error: 'Tidak bisa menghapus akun sendiri.' };
    if (u.role === 'admin' && u.aktif !== false && countActiveAdmins(u.id) === 0) {
      return { ok: false, error: 'Tidak bisa menghapus satu-satunya admin aktif.' };
    }
    setUsers(users.filter(function (x) { return x.id !== id; }));
    return { ok: true };
  }

  function setPassword(actor, id, newPassword) {
    var err = assertAdmin(actor);
    if (err) return Promise.resolve({ ok: false, error: err });
    if (String(newPassword || '').length < 6) return Promise.resolve({ ok: false, error: 'Password minimal 6 karakter.' });
    var users = getUsers();
    var u = users.find(function (x) { return x.id === id; });
    if (!u) return Promise.resolve({ ok: false, error: 'Pengguna tidak ditemukan.' });
    return hashPassword(newPassword).then(function (pw) {
      u.pass = pw;
      setUsers(users);
      return { ok: true };
    });
  }

  function changeOwnPassword(userId, oldPassword, newPassword) {
    var users = getUsers();
    var u = users.find(function (x) { return x.id === userId; });
    if (!u) return Promise.resolve({ ok: false, error: 'Pengguna tidak ditemukan.' });
    if (String(newPassword || '').length < 6) return Promise.resolve({ ok: false, error: 'Password baru minimal 6 karakter.' });
    return verifyPassword(oldPassword || '', u.pass).then(function (match) {
      if (!match) return { ok: false, error: 'Password lama salah.' };
      return hashPassword(newPassword).then(function (pw) {
        u.pass = pw;
        setUsers(users);
        return { ok: true };
      });
    });
  }

  return {
    ROLE_PAGES: ROLE_PAGES,
    ROLE_LABEL: ROLE_LABEL,
    seedUsers: seedUsers,
    getUsers: function () { return getUsers().map(publicUser); },
    login: login,
    logout: logout,
    current: current,
    can: can,
    pagesFor: pagesFor,
    defaultPage: defaultPage,
    roleLabel: function (r) { return ROLE_LABEL[r] || r; },
    createUser: createUser,
    updateUser: updateUser,
    deleteUser: deleteUser,
    setPassword: setPassword,
    changeOwnPassword: changeOwnPassword,
    hashPassword: hashPassword
  };
})();
