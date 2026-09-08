/* App shell: auth gate, navigasi berbasis role, statistik, jam */
var currentPage = 'kasir';
var clockStarted = false;
var loginFails = 0;
var loginLockedUntil = 0;

var MENU = [
  { id: 'kasir', icon: '🛒', label: 'Kasir', short: 'Kasir', roles: ['kasir'] },
  { id: 'pembelian', icon: '📦', label: 'Pembelian', short: 'Beli', roles: ['admin'] },
  { id: 'stok', icon: '🏷️', label: 'Stok Barang', short: 'Stok', roles: ['admin'] },
  { id: 'keuangan', icon: '💰', label: 'Keuangan', short: 'Kas', roles: ['admin'] },
  { id: 'laporan', icon: '📊', label: 'Laporan', short: 'Laporan', roles: ['admin'] },
  { id: 'pengaturan', icon: '⚙️', label: 'Pengaturan Akun', short: 'Akun', roles: ['admin'] }
];

var PAGE_META = {
  kasir: ['Kasir', 'Penjualan • stok otomatis berkurang + kas masuk'],
  pembelian: ['Pembelian', 'Restok • stok otomatis bertambah + kas keluar/hutang'],
  stok: ['Stok Barang', 'Master data & persediaan'],
  keuangan: ['Keuangan', 'Buku kas & hutang (jurnal otomatis)'],
  laporan: ['Laporan', 'Laba rugi, neraca & arus kas'],
  pengaturan: ['Pengaturan Akun', 'Kelola pengguna & password (khusus admin)']
};

/* ---------- Boot: seed → cek sesi → login / app ---------- */

function initApp() {
  POSStore.seedIfNeeded();
  bindNav();
  Auth.seedUsers().then(function () {
    var user = Auth.current();
    if (user) enterApp(user);
    else showLogin();
  });
}

function bindNav() {
  // Delegasi global: berlaku untuk tombol nav yg dirender dinamis
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-page]') : null;
    if (btn && btn.dataset.page) showPage(btn.dataset.page);
  });
  document.getElementById('btnMobileMenu').addEventListener('click', function () {
    document.getElementById('mobileNav').classList.toggle('hidden');
  });
}

/* ---------- Login / logout ---------- */

function showLogin() {
  document.getElementById('appRoot').classList.add('hidden');
  var ls = document.getElementById('loginScreen');
  ls.classList.remove('hidden');
  var u = document.getElementById('loginUser');
  if (u) u.focus();
}

function toggleLoginPw() {
  var inp = document.getElementById('loginPass');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function showLoginError(msg) {
  var el = document.getElementById('loginError');
  el.textContent = msg;
  el.classList.remove('hidden');
  var card = document.querySelector('.login-card');
  if (card) {
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
  }
}

function hideLoginError() {
  document.getElementById('loginError').classList.add('hidden');
}

async function handleLogin(e) {
  if (e) e.preventDefault();
  if (Date.now() < loginLockedUntil) {
    showLoginError('Terlalu banyak gagal login. Coba lagi beberapa detik.');
    return false;
  }
  var u = document.getElementById('loginUser').value;
  var p = document.getElementById('loginPass').value;
  var btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = 'Memeriksa...';
  try {
    var res = await Auth.login(u, p);
    if (!res.ok) {
      loginFails++;
      if (loginFails >= 5) {
        loginLockedUntil = Date.now() + 30000;
        loginFails = 0;
        showLoginError('Terlalu banyak gagal login. Terkunci 30 detik.');
      } else {
        showLoginError(res.error + (loginFails >= 3 ? ' (' + loginFails + 'x gagal)' : ''));
      }
      return false;
    }
    loginFails = 0;
    hideLoginError();
    document.getElementById('loginPass').value = '';
    enterApp(res.user);
    toast('Selamat datang, ' + res.user.nama + ' ✓');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Masuk';
  }
  return false;
}

function logout() {
  Auth.logout();
  document.getElementById('mobileNav').classList.add('hidden');
  showLogin();
}

/* ---------- Masuk app sesuai role ---------- */

function enterApp(user) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appRoot').classList.remove('hidden');
  applySessionUI();
  initKasir();
  initPembelian();
  initStok();
  initKeuangan();
  initLaporan();
  initPengaturan();
  refreshStats();
  startClock();
  showPage(Auth.defaultPage(user.role));
}

// Dipanggil ulang saat data user berubah (mis. role diganti dari Pengaturan)
function applySessionUI() {
  var user = Auth.current();
  if (!user) { showLogin(); return; }
  renderNav(user.role);
  var initial = (user.nama || '?').trim().charAt(0).toUpperCase();
  document.getElementById('userName').textContent = user.nama;
  document.getElementById('userRole').textContent = Auth.roleLabel(user.role);
  document.getElementById('userAvatar').textContent = initial;
  document.getElementById('sideUser').textContent = user.nama;
  document.getElementById('sideRole').textContent = '@' + user.username + ' • ' + Auth.roleLabel(user.role);
  document.getElementById('sideAvatar').textContent = initial;
  // Reset data demo = aksi admin
  document.getElementById('btnResetDemo').style.display = user.role === 'admin' ? '' : 'none';
  // Bila halaman aktif tak lagi diizinkan (role diganti), pindahkan
  if (!Auth.can(user.role, currentPage)) showPage(Auth.defaultPage(user.role));
}

function renderNav(role) {
  var items = MENU.filter(function (m) { return m.roles.indexOf(role) !== -1; });
  document.getElementById('desktopMenu').innerHTML = items.map(function (m) {
    return '<button data-page="' + m.id + '" class="nav-btn">' + m.icon + ' <span>' + m.label + '</span></button>';
  }).join('');
  var mobile = document.getElementById('mobileNav');
  mobile.style.display = 'grid';
  mobile.style.gridTemplateColumns = 'repeat(' + items.length + ', minmax(0, 1fr))';
  mobile.innerHTML = items.map(function (m) {
    return '<button data-page="' + m.id + '" class="nav-btn-mobile">' + m.icon + '<br>' + m.short + '</button>';
  }).join('');
}

/* ---------- Navigasi + guard ---------- */

function showPage(name) {
  var user = Auth.current();
  if (!user) { showLogin(); return; }
  if (!PAGE_META[name]) name = Auth.defaultPage(user.role);
  if (!Auth.can(user.role, name)) {
    toast('Akses ditolak: menu ini khusus ' + (user.role === 'kasir' ? 'admin' : 'kasir') + '.', 'error');
    name = Auth.defaultPage(user.role);
  }
  currentPage = name;
  document.querySelectorAll('.page').forEach(function (p) { p.classList.add('hidden'); });
  document.getElementById('page-' + name).classList.remove('hidden');
  document.getElementById('pageTitle').textContent = PAGE_META[name][0];
  document.getElementById('pageSubtitle').textContent = PAGE_META[name][1];
  document.querySelectorAll('#navDesktop .nav-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.page === name);
  });
  document.querySelectorAll('#mobileNav .nav-btn-mobile').forEach(function (b) {
    b.classList.toggle('active', b.dataset.page === name);
  });
  document.getElementById('mobileNav').classList.add('hidden');
  if (name === 'laporan') renderLaporan();
  if (name === 'keuangan') renderKeuangan();
  if (name === 'stok') renderStokTable();
  if (name === 'kasir') { renderKasirGrid(); renderKasirHistory(); }
  if (name === 'pembelian') { renderBeliHistory(); refreshBeliProdukOptions(); }
  if (name === 'pengaturan') renderPengaturan();
  refreshStats();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function refreshStats() {
  var today = new Date().toDateString();
  var all = POSStore.getTransactions();
  var jualHariIni = all.filter(function (t) { return t.tipe === 'penjualan' && new Date(t.tanggal).toDateString() === today; });
  var omzet = jualHariIni.reduce(function (a, t) { return a + t.total; }, 0);
  var hpp = 0;
  jualHariIni.forEach(function (t) {
    t.items.forEach(function (it) {
      var h = it.hpp;
      if (h == null) {
        var p = POSStore.getProducts().find(function (x) { return x.id === it.productId; });
        h = p ? p.hargaBeli : 0;
      }
      hpp += h * it.qty;
    });
  });
  var products = POSStore.getProducts();
  var totalStok = products.reduce(function (a, p) { return a + p.stok; }, 0);
  var low = products.filter(function (p) { return p.stok <= p.minStok; }).length;
  var nilai = products.reduce(function (a, p) { return a + p.stok * p.hargaBeli; }, 0);

  document.getElementById('statOmzet').textContent = POSStore.formatRupiah(omzet);
  document.getElementById('statTrx').textContent = jualHariIni.length + ' transaksi';
  document.getElementById('statLaba').textContent = POSStore.formatRupiah(omzet - hpp);
  document.getElementById('statStok').textContent = totalStok.toLocaleString('id-ID') + ' pcs';
  document.getElementById('statStokRendah').textContent = low + ' barang menipis';
  document.getElementById('statPersediaan').textContent = POSStore.formatRupiah(nilai);

  var acc = POSStore.getAccounts().find(function (a) { return a.kode === '1-100'; });
  // Saldo kas dibaca dari JURNAL (otomatis dari kasir/pembelian/beban).
  var kas = (typeof POSStore.getSaldoKas === 'function')
    ? POSStore.getSaldoKas()
    : (function () {
      var kasAwal = acc ? acc.saldoAwal : 0;
      var totJual = all.filter(function (t) { return t.tipe === 'penjualan'; }).reduce(function (a, t) { return a + t.total; }, 0);
      var totBeli = all.filter(function (t) { return t.tipe === 'pembelian'; }).reduce(function (a, t) { return a + t.total; }, 0);
      var totBeban = POSStore.getExpenses().reduce(function (a, b) { return a + b.jumlah; }, 0);
      return kasAwal + totJual - totBeli - totBeban;
    })();
  document.getElementById('sidebarCash').textContent = POSStore.formatRupiah(kas);
}

function startClock() {
  if (clockStarted) return;
  clockStarted = true;
  function tick() {
    document.getElementById('clock').textContent = new Date().toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  tick();
  setInterval(tick, 30000);
}

async function resetDemoData() {
  var user = Auth.current();
  if (!user || user.role !== 'admin') { toast('Hanya admin yang boleh mereset data.', 'error'); return; }
  var ok = await UI.confirm({
    title: 'Reset data demo?',
    message: 'Semua transaksi, stok, dan jurnal akan dikembalikan ke sampel awal. Data saat ini hilang.',
    confirmText: 'Ya, reset',
    tone: 'danger'
  });
  if (!ok) return;
  POSStore.resetDemo();
  cart = []; beliItems = [];
  initKasir(); initPembelian(); initStok(); renderLaporan(); refreshStats();
  toast('Data demo direset ✓');
}

document.addEventListener('DOMContentLoaded', initApp);
