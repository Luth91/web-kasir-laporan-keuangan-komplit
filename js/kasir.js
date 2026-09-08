/* ============================================================
 * Kasir / Penjualan (Barang Keluar)
 * - Stok otomatis BERKURANG saat checkout, dengan validasi.
 * - Otomatis mencatat PEMASUKAN KAS di jurnal keuangan.
 * - HPP di-snapshot per item saat transaksi (hargaBeli saat itu),
 *   sehingga laporan laba tidak berubah walau harga beli berubah.
 * ============================================================ */
var cart = [];
var payMethod = 'Tunai';

function initKasir() {
  var cats = [...new Set(POSStore.getProducts().map(function (p) { return p.kategori; }))];
  var sel = document.getElementById('kasirKategori');
  sel.innerHTML = '<option value="">Semua kategori</option>' + cats.map(function (c) {
    return '<option>' + c + '</option>';
  }).join('');
  var search = document.getElementById('kasirSearch');
  if (!search.dataset.bound) {
    search.dataset.bound = '1';
    search.addEventListener('input', renderKasirGrid);
    sel.addEventListener('change', renderKasirGrid);
    document.getElementById('kasirBayar').addEventListener('input', updateKembalian);
    document.querySelectorAll('#payMethods .pay-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('#payMethods .pay-btn').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        payMethod = b.dataset.m;
        updateKembalian();
      });
    });
  }
  renderKasirGrid();
  renderCart();
  renderKasirHistory();
}

function renderKasirGrid() {
  var q = (document.getElementById('kasirSearch').value || '').toLowerCase();
  var kat = document.getElementById('kasirKategori').value;
  var list = POSStore.getProducts().filter(function (p) {
    var okQ = p.nama.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    var okK = !kat || p.kategori === kat;
    return okQ && okK;
  });
  var grid = document.getElementById('kasirGrid');
  if (!list.length) { grid.innerHTML = '<p class="col-span-full text-center text-sm text-slate-400 py-8">Barang tidak ditemukan.</p>'; return; }
  grid.innerHTML = list.map(function (p) {
    var habis = p.stok <= 0;
    return '<div class="border rounded-xl p-3 hover:shadow-md transition ' + (habis ? 'opacity-50' : '') + '">' +
      '<p class="font-semibold text-sm leading-tight">' + p.nama + '</p>' +
      '<p class="text-[11px] text-slate-400">' + p.sku + ' • ' + p.kategori + '</p>' +
      '<p class="text-blue-700 font-bold text-sm mt-1">' + POSStore.formatRupiah(p.hargaJual) + '</p>' +
      '<p class="text-[11px] ' + (p.stok <= p.minStok ? 'text-red-500 font-semibold' : 'text-slate-500') + '">Stok: ' + p.stok + '</p>' +
      '<button ' + (habis ? 'disabled' : '') + ' onclick="addToCart(\'' + p.id + '\')" class="mt-2 w-full text-xs font-bold rounded-lg py-2 ' + (habis ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700') + '">' + (habis ? 'Habis' : '+ Keranjang') + '</button>' +
      '</div>';
  }).join('');
}

function addToCart(id) {
  var p = POSStore.getProducts().find(function (x) { return x.id === id; });
  if (!p || p.stok <= 0) return toast('⚠️ Stok "' + (p ? p.nama : '') + '" habis!');
  var row = cart.find(function (c) { return c.productId === id; });
  var inCart = row ? row.qty : 0;
  if (inCart + 1 > p.stok) return toast('⚠️ Stok tidak cukup! Sisa ' + p.stok + ' • "' + p.nama + '"');
  if (row) row.qty++;
  else cart.push({ productId: p.id, nama: p.nama, harga: p.hargaJual, hpp: p.hargaBeli, qty: 1 });
  renderCart();
}

function cartQty(id, d) {
  var row = cart.find(function (c) { return c.productId === id; });
  if (!row) return;
  var p = POSStore.getProducts().find(function (x) { return x.id === id; });
  if (d > 0 && p && row.qty + 1 > p.stok) return toast('⚠️ Stok tidak cukup! Sisa ' + p.stok + ' • "' + p.nama + '"');
  row.qty += d;
  if (row.qty <= 0) cart = cart.filter(function (c) { return c.productId !== id; });
  renderCart();
}

function cartTotal() { return cart.reduce(function (a, c) { return a + c.qty * c.harga; }, 0); }
function cartHpp() { return cart.reduce(function (a, c) { return a + c.qty * (c.hpp || 0); }, 0); }

function renderCart() {
  var box = document.getElementById('cartList');
  document.getElementById('cartCount').textContent = cart.reduce(function (a, c) { return a + c.qty; }, 0);
  if (!cart.length) box.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Keranjang kosong.<br>Klik barang di kiri untuk menambah.</p>';
  else box.innerHTML = cart.map(function (c) {
    return '<div class="flex items-center gap-2 border rounded-xl p-2 text-sm">' +
      '<div class="flex-1 min-w-0"><p class="font-semibold truncate">' + c.nama + '</p>' +
      '<p class="text-xs text-slate-500">' + POSStore.formatRupiah(c.harga) + ' • HPP ' + POSStore.formatRupiah(c.hpp || 0) + '</p></div>' +
      '<div class="flex items-center gap-1">' +
      '<button onclick="cartQty(\'' + c.productId + '\',-1)" class="qty-btn">−</button>' +
      '<span class="w-6 text-center font-bold">' + c.qty + '</span>' +
      '<button onclick="cartQty(\'' + c.productId + '\',1)" class="qty-btn">+</button></div>' +
      '<span class="font-bold text-xs w-20 text-right">' + POSStore.formatRupiah(c.qty * c.harga) + '</span></div>';
  }).join('');
  document.getElementById('cartSubtotal').textContent = POSStore.formatRupiah(cartTotal());
  document.getElementById('cartTotal').textContent = POSStore.formatRupiah(cartTotal());
  var hppEl = document.getElementById('cartHpp');
  if (hppEl) hppEl.textContent = POSStore.formatRupiah(cartHpp());
  updateKembalian();
}

function updateKembalian() {
  var bayar = Number(document.getElementById('kasirBayar').value) || 0;
  var kembali = payMethod === 'Tunai' ? bayar - cartTotal() : 0;
  var el = document.getElementById('kasirKembalian');
  el.textContent = POSStore.formatRupiah(Math.max(kembali, 0));
  el.className = 'font-bold ' + (kembali < 0 ? 'text-red-600' : 'text-green-600');
}

function clearCart() { cart = []; document.getElementById('kasirBayar').value = ''; renderCart(); }

function checkoutKasir() {
  if (!cart.length) return toast('Keranjang masih kosong!');
  var total = cartTotal();
  var totalHpp = cartHpp();
  var bayar = Number(document.getElementById('kasirBayar').value) || 0;
  if (payMethod === 'Tunai' && bayar < total) return toast('Uang bayar kurang ' + POSStore.formatRupiah(total - bayar));

  var products = POSStore.getProducts();

  // 1) VALIDASI STOK — kumpulkan semua yang bermasalah dulu
  var kurang = [];
  cart.forEach(function (c) {
    var p = products.find(function (x) { return x.id === c.productId; });
    if (!p) kurang.push(c.nama + ' (barang dihapus)');
    else if (p.stok < c.qty) kurang.push('"' + p.nama + '" sisa ' + p.stok + ', diminta ' + c.qty);
  });
  if (kurang.length) return toast('⚠️ Stok tidak cukup: ' + kurang.join('; '));

  // 2) KURANGI STOK + catat riwayat keluar (audit trail)
  var txId = POSStore.uid('JUAL');
  var nowISO = new Date().toISOString();
  cart.forEach(function (c) {
    var p = products.find(function (x) { return x.id === c.productId; });
    var sebelum = p.stok;
    p.stok -= c.qty;
    // refresh snapshot HPP ke harga beli TERKINI saat transaksi
    c.hpp = p.hargaBeli;
    POSStore.logStockMove({
      tanggal: nowISO, productId: p.id, nama: p.nama,
      tipe: 'keluar', qty: c.qty, stokSebelum: sebelum, stokSesudah: p.stok,
      refId: txId, keterangan: 'Penjualan ' + txId
    });
  });
  POSStore.setProducts(products);

  // 3) SIMPAN TRANSAKSI + HPP & LABA
  var tx = {
    id: txId,
    tanggal: nowISO,
    tipe: 'penjualan',
    items: cart.map(function (c) { return { productId: c.productId, nama: c.nama, qty: c.qty, harga: c.harga, hpp: c.hpp, subtotal: c.qty * c.harga }; }),
    total: total,
    totalHpp: cart.reduce(function (a, c) { return a + c.qty * (c.hpp || 0); }, 0),
    totalLaba: 0,
    bayar: payMethod === 'Tunai' ? bayar : total,
    kembalian: payMethod === 'Tunai' ? bayar - total : 0,
    metode: payMethod,
    kasir: (typeof Auth !== 'undefined' && Auth.current() ? Auth.current().nama : 'Kasir'),
    keterangan: ''
  };
  tx.totalLaba = tx.total - tx.totalHpp;
  var all = POSStore.getTransactions();
  all.unshift(tx);
  POSStore.setTransactions(all);

  // 4) JURNAL KEUANGAN OTOMATIS — pemasukan kas
  POSStore.recordFinance({
    tanggal: nowISO, arus: 'masuk', kategori: 'penjualan',
    jumlah: total, metode: payMethod, akunKode: '1-100',
    refId: tx.id, keterangan: 'Pemasukan kas dari ' + tx.id + ' (HPP ' + POSStore.formatRupiah(tx.totalHpp) + ')'
  });

  showStruk(tx);
  clearCart();
  renderKasirGrid();
  renderKasirHistory();
  if (typeof renderKeuangan === 'function' && document.getElementById('page-keuangan')) renderKeuangan();
  refreshStats();
  toast('Penjualan tersimpan ✓ Stok −' + tx.items.reduce(function (a, i) { return a + i.qty; }, 0) + ' • Laba ' + POSStore.formatRupiah(tx.totalLaba));
}

function showStruk(tx) {
  var rows = tx.items.map(function (it) {
    return '<div class="flex justify-between"><span>' + it.qty + 'x ' + it.nama + '</span><span>' + POSStore.formatRupiah(it.subtotal) + '</span></div>';
  }).join('');
  document.getElementById('strukBody').innerHTML =
    '<p class="text-center font-bold text-base">TOKO KASIRKU</p>' +
    '<p class="text-center text-xs mb-2">Jl. Merdeka No. 1 • Telp 0812-0000</p>' +
    '<p class="text-xs">No: ' + tx.id + '<br>' + POSStore.formatTanggal(tx.tanggal) + ' • ' + tx.metode + '</p>' +
    '<hr class="my-2 border-dashed">' + rows + '<hr class="my-2 border-dashed">' +
    '<div class="flex justify-between font-bold"><span>TOTAL</span><span>' + POSStore.formatRupiah(tx.total) + '</span></div>' +
    '<div class="flex justify-between text-xs"><span>Bayar</span><span>' + POSStore.formatRupiah(tx.bayar) + '</span></div>' +
    '<div class="flex justify-between text-xs"><span>Kembalian</span><span>' + POSStore.formatRupiah(tx.kembalian) + '</span></div>' +
    '<p class="text-center text-xs mt-2">Terima kasih 🙏</p>';
  document.getElementById('strukModal').classList.remove('hidden');
}

function renderKasirHistory() {
  var today = new Date().toDateString();
  var list = POSStore.getTransactions().filter(function (t) {
    return t.tipe === 'penjualan' && new Date(t.tanggal).toDateString() === today;
  });
  var tb = document.getElementById('kasirHistory');
  if (!list.length) { tb.innerHTML = '<tr><td colspan="7" class="text-center text-slate-400 text-sm py-4">Belum ada penjualan hari ini.</td></tr>'; return; }
  tb.innerHTML = list.map(function (t) {
    var hpp = (t.totalHpp != null) ? t.totalHpp : POSStore.calcHppOfTx(t, POSStore.getProducts());
    var laba = (t.totalLaba != null) ? t.totalLaba : (t.total - hpp);
    return '<tr><td class="font-mono text-xs">' + t.id + '</td><td class="text-xs">' + POSStore.formatTanggal(t.tanggal) + '</td>' +
      '<td class="text-xs">' + t.items.map(function (i) { return i.qty + 'x ' + i.nama; }).join(', ') + '</td>' +
      '<td class="font-bold">' + POSStore.formatRupiah(t.total) + '<div class="text-[10px] font-normal text-slate-400">HPP ' + POSStore.formatRupiah(hpp) + ' • Laba ' + POSStore.formatRupiah(laba) + '</div></td>' +
      '<td><span class="badge">' + t.metode + '</span></td>' +
      '<td class="font-semibold text-green-700 text-xs">Kas +</td>' +
      '<td><button onclick="batalTransaksi(\'' + t.id + '\')" class="text-xs text-red-500 hover:underline">Batal</button></td></tr>';
  }).join('');
}

async function batalTransaksi(id) {
  var ok = await UI.confirm({
    title: 'Batalkan transaksi?',
    message: 'Stok akan dikembalikan & jurnal kas otomatis dihapus.',
    confirmText: 'Ya, batalkan',
    tone: 'danger'
  });
  if (!ok) return;
  var all = POSStore.getTransactions();
  var tx = all.find(function (t) { return t.id === id; });
  if (!tx) return;
  if (tx.tipe === 'penjualan') {
    var products = POSStore.getProducts();
    var nowISO = new Date().toISOString();
    tx.items.forEach(function (it) {
      var p = products.find(function (x) { return x.id === it.productId; });
      if (p) {
        var sebelum = p.stok;
        p.stok += it.qty;
        POSStore.logStockMove({
          tanggal: nowISO, productId: p.id, nama: p.nama,
          tipe: 'masuk', qty: it.qty, stokSebelum: sebelum, stokSesudah: p.stok,
          refId: 'BATAL-' + tx.id, keterangan: 'Retur pembatalan ' + tx.id
        });
      }
    });
    POSStore.setProducts(products);
  }
  POSStore.removeFinanceByRef(id); // hapus jurnal kas otomatisnya
  POSStore.setTransactions(all.filter(function (t) { return t.id !== id; }));
  renderKasirGrid(); renderKasirHistory(); renderStokTable(); refreshStats();
  if (typeof renderKeuangan === 'function') renderKeuangan();
  if (typeof renderLaporan === 'function') renderLaporan();
  toast('Transaksi dibatalkan, stok & kas dikembalikan.');
}
