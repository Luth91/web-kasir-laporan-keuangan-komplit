/* ============================================================
 * Pembelian / Restok (Barang Masuk)
 * Form: Pilih Barang, Jumlah Masuk, Harga Beli/Unit, Tanggal,
 *       Supplier, Metode (Tunai/Transfer/QRIS/Kredit).
 * Saat disimpan:
 *  1) Stok otomatis BERTAMBAH + riwayat masuk dicatat.
 *  2) Jurnal OTOMATIS: kas KELUAR, atau HUTANG bila Kredit.
 * ============================================================ */
var beliItems = [];

function initPembelian() {
  refreshBeliProdukOptions();
  var tgl = document.getElementById('beliTanggal');
  if (tgl && !tgl.value) tgl.value = new Date().toISOString().slice(0, 10);
  renderBeliList();
  renderBeliHistory();
}

function refreshBeliProdukOptions() {
  var sel = document.getElementById('beliProduk');
  if (!sel) return;
  sel.innerHTML = POSStore.getProducts().map(function (p) {
    return '<option value="' + p.id + '">' + p.nama + ' — stok ' + p.stok + ' (' + POSStore.formatRupiah(p.hargaBeli) + ')</option>';
  }).join('');
  var first = POSStore.getProducts()[0];
  if (first) document.getElementById('beliHarga').value = first.hargaBeli;
  sel.onchange = function () {
    var p = POSStore.getProducts().find(function (x) { return x.id === sel.value; });
    if (p) document.getElementById('beliHarga').value = p.hargaBeli;
  };
}

function tambahItemBeli() {
  var pid = document.getElementById('beliProduk').value;
  var qty = Number(document.getElementById('beliQty').value) || 0;
  var harga = Number(document.getElementById('beliHarga').value) || 0;
  if (!pid || qty <= 0) return toast('⚠️ Jumlah masuk harus lebih dari 0!');
  if (harga <= 0) return toast('⚠️ Harga beli per unit harus lebih dari 0!');
  var p = POSStore.getProducts().find(function (x) { return x.id === pid; });
  if (!p) return toast('Barang tidak ditemukan!');
  var row = beliItems.find(function (r) { return r.productId === pid; });
  if (row) { row.qty += qty; row.harga = harga; }
  else beliItems.push({ productId: pid, nama: p.nama, qty: qty, harga: harga });
  document.getElementById('beliQty').value = '';
  renderBeliList();
  toast(qty + ' × ' + p.nama + ' masuk daftar ✓');
}

function hapusItemBeli(pid) {
  beliItems = beliItems.filter(function (r) { return r.productId !== pid; });
  renderBeliList();
}

function beliTotal() { return beliItems.reduce(function (a, r) { return a + r.qty * r.harga; }, 0); }

function renderBeliList() {
  var box = document.getElementById('beliList');
  if (!box) return;
  if (!beliItems.length) box.innerHTML = '<p class="text-xs text-slate-400 border border-dashed rounded-xl p-3 text-center">Belum ada item. Pilih barang + jumlah masuk + harga beli, lalu klik + Tambah.</p>';
  else box.innerHTML = beliItems.map(function (r) {
    return '<div class="flex items-center gap-2 border rounded-xl p-2 text-sm">' +
      '<div class="flex-1"><p class="font-semibold">' + r.nama + '</p>' +
      '<p class="text-xs text-slate-500">Masuk: ' + r.qty + ' × ' + POSStore.formatRupiah(r.harga) + '</p></div>' +
      '<span class="font-bold text-sm">' + POSStore.formatRupiah(r.qty * r.harga) + '</span>' +
      '<button onclick="hapusItemBeli(\'' + r.productId + '\')" class="text-red-500 text-lg leading-none px-1">×</button></div>';
  }).join('');
  document.getElementById('beliTotal').textContent = POSStore.formatRupiah(beliTotal());
}

function simpanPembelian() {
  if (!beliItems.length) return toast('Tambahkan item pembelian dulu!');
  var supplier = (document.getElementById('beliSupplier').value || '-').trim() || '-';
  var metode = document.getElementById('beliMetode').value;
  var tglInput = document.getElementById('beliTanggal').value;
  if (!tglInput) return toast('⚠️ Tanggal pembelian wajib diisi!');
  var tanggalISO = new Date(tglInput + 'T' + new Date().toTimeString().slice(0, 8)).toISOString();
  var total = beliTotal();
  var txId = POSStore.uid('BELI');

  // 1) STOK OTOMATIS BERTAMBAH + riwayat masuk
  var products = POSStore.getProducts();
  beliItems.forEach(function (r) {
    var p = products.find(function (x) { return x.id === r.productId; });
    if (p) {
      var sebelum = p.stok;
      p.stok += r.qty;
      p.hargaBeli = r.harga; // HPP acuan = harga beli terakhir
      POSStore.logStockMove({
        tanggal: tanggalISO, productId: p.id, nama: p.nama,
        tipe: 'masuk', qty: r.qty, stokSebelum: sebelum, stokSesudah: p.stok,
        refId: txId, keterangan: 'Pembelian dari ' + supplier + ' @' + POSStore.formatRupiah(r.harga)
      });
    }
  });
  POSStore.setProducts(products);

  // 2) SIMPAN TRANSAKSI PEMBELIAN
  var tx = {
    id: txId,
    tanggal: tanggalISO,
    tipe: 'pembelian',
    items: beliItems.map(function (r) { return { productId: r.productId, nama: r.nama, qty: r.qty, harga: r.harga, subtotal: r.qty * r.harga }; }),
    total: total, bayar: metode === 'Kredit' ? 0 : total, kembalian: 0,
    metode: metode, supplier: supplier, keterangan: 'Pembelian ke ' + supplier
  };
  var all = POSStore.getTransactions();
  all.unshift(tx);
  POSStore.setTransactions(all);

  // 3) JURNAL KEUANGAN OTOMATIS — kas keluar ATAU hutang
  var isKredit = (metode === 'Kredit');
  POSStore.recordFinance({
    tanggal: tanggalISO,
    arus: isKredit ? 'hutang' : 'keluar',
    kategori: 'pembelian', jumlah: total, metode: metode,
    akunKode: isKredit ? '2-100' : '1-100', refId: tx.id,
    keterangan: (isKredit ? 'Hutang ke ' + supplier : 'Pengeluaran kas ke ' + supplier) + ' (' + tx.id + ')'
  });

  var infoKas = isKredit ? 'Hutang +' + POSStore.formatRupiah(total) : 'Kas −' + POSStore.formatRupiah(total);
  beliItems = [];
  document.getElementById('beliQty').value = 10;
  renderBeliList(); renderBeliHistory(); renderKasirGrid(); renderStokTable(); refreshStats(); refreshBeliProdukOptions();
  if (typeof renderKeuangan === 'function') renderKeuangan();
  if (typeof renderLaporan === 'function') renderLaporan();
  toast('Pembelian tersimpan ✓ Stok + • ' + infoKas);
}

async function batalPembelian(id) {
  var ok = await UI.confirm({
    title: 'Batalkan pembelian?',
    message: 'Stok dikurangi kembali & jurnal keuangan dihapus.',
    confirmText: 'Ya, batalkan',
    tone: 'danger'
  });
  if (!ok) return;
  var all = POSStore.getTransactions();
  var tx = all.find(function (t) { return t.id === id; });
  if (!tx || tx.tipe !== 'pembelian') return;
  var products = POSStore.getProducts();
  var kurang = [];
  tx.items.forEach(function (it) {
    var p = products.find(function (x) { return x.id === it.productId; });
    if (p && p.stok < it.qty) kurang.push('"' + p.nama + '" sisa ' + p.stok);
  });
  if (kurang.length) return toast('⚠️ Gagal batal: stok sudah terpakai ({})'.replace('{}', kurang.join(', ')));
  var nowISO = new Date().toISOString();
  tx.items.forEach(function (it) {
    var p = products.find(function (x) { return x.id === it.productId; });
    if (p) {
      var sebelum = p.stok;
      p.stok -= it.qty;
      POSStore.logStockMove({
        tanggal: nowISO, productId: p.id, nama: p.nama,
        tipe: 'keluar', qty: it.qty, stokSebelum: sebelum, stokSesudah: p.stok,
        refId: 'BATAL-' + tx.id, keterangan: 'Pembatalan pembelian ' + tx.id
      });
    }
  });
  POSStore.setProducts(products);
  POSStore.removeFinanceByRef(id);
  POSStore.setTransactions(all.filter(function (t) { return t.id !== id; }));
  renderBeliList(); renderBeliHistory(); renderKasirGrid(); renderStokTable(); refreshStats();
  if (typeof renderKeuangan === 'function') renderKeuangan();
  toast('Pembelian dibatalkan, stok & jurnal dikembalikan.');
}

function tambahProdukBaru() {
  var nama = document.getElementById('newNama').value.trim();
  var kat = document.getElementById('newKategori').value.trim() || 'Lainnya';
  var hb = Number(document.getElementById('newBeli').value) || 0;
  var hj = Number(document.getElementById('newJual').value) || 0;
  if (!nama || hb <= 0 || hj <= 0) return toast('Lengkapi nama, harga beli & jual!');
  var products = POSStore.getProducts();
  var n = products.length + 1;
  products.push({
    id: POSStore.uid('BRG'), sku: 'SKU-' + String(n).padStart(3, '0'),
    nama: nama, kategori: kat, hargaBeli: hb, hargaJual: hj, stok: 0, satuan: 'pcs', minStok: 10
  });
  POSStore.setProducts(products);
  document.getElementById('newNama').value = '';
  document.getElementById('newBeli').value = '';
  document.getElementById('newJual').value = '';
  refreshBeliProdukOptions(); renderKasirGrid(); renderStokTable(); refreshStats();
  toast('Barang baru ditambahkan ✓ (stok awal 0 — restok via form di atas)');
}

function renderBeliHistory() {
  var box = document.getElementById('beliHistory');
  if (!box) return;
  var list = POSStore.getTransactions().filter(function (t) { return t.tipe === 'pembelian'; }).slice(0, 20);
  if (!list.length) { box.innerHTML = '<p class="text-xs text-slate-400">Belum ada pembelian.</p>'; return; }
  box.innerHTML = list.map(function (t) {
    var tag = t.metode === 'Kredit' ? '<span class="badge">Hutang</span>' : '<span class="badge-red">Kas −</span>';
    return '<div class="border rounded-xl p-3 text-sm">' +
      '<div class="flex justify-between items-center"><span class="font-mono text-xs text-slate-500">' + t.id + '</span>' + tag + '</div>' +
      '<div class="flex justify-between mt-1"><span class="text-xs text-slate-500">' + POSStore.formatTanggal(t.tanggal) + ' • ' + (t.supplier || '-') + ' • ' + t.metode + '</span>' +
      '<span class="font-bold">' + POSStore.formatRupiah(t.total) + '</span></div>' +
      '<p class="text-xs mt-1">' + t.items.map(function (i) { return '+' + i.qty + 'x ' + i.nama + ' @' + POSStore.formatRupiah(i.harga); }).join(', ') + '</p>' +
      '<button onclick="batalPembelian(\'' + t.id + '\')" class="text-xs text-red-500 hover:underline mt-1">Batalkan (kembalikan stok)</button></div>';
  }).join('');
}
