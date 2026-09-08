/* Stok Barang */
var editingId = null;

function initStok() {
  document.getElementById('stokSearch').addEventListener('input', renderStokTable);
  renderStokTable();
}

function renderStokTable() {
  var q = (document.getElementById('stokSearch').value || '').toLowerCase();
  var list = POSStore.getProducts().filter(function (p) {
    return p.nama.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.kategori.toLowerCase().includes(q);
  });
  var tb = document.getElementById('stokTable');
  if (!list.length) { tb.innerHTML = '<tr><td colspan="8" class="text-center text-slate-400 text-sm py-4">Tidak ada barang.</td></tr>'; }
  else tb.innerHTML = list.map(function (p) {
    var status = p.stok <= 0
      ? '<span class="badge-red">Habis</span>'
      : p.stok <= p.minStok ? '<span class="badge-red">Menipis</span>' : '<span class="badge-green">Aman</span>';
    return '<tr><td class="font-mono text-xs">' + p.sku + '</td>' +
      '<td class="font-semibold">' + p.nama + '</td><td class="text-xs">' + p.kategori + '</td>' +
      '<td class="text-xs">' + POSStore.formatRupiah(p.hargaBeli) + '</td>' +
      '<td class="font-semibold text-xs">' + POSStore.formatRupiah(p.hargaJual) + '</td>' +
      '<td><span class="font-bold">' + p.stok + '</span> ' + status + '</td>' +
      '<td class="text-xs">' + POSStore.formatRupiah(p.stok * p.hargaBeli) + '</td>' +
      '<td class="whitespace-nowrap"><button onclick="openProdukModal(\'' + p.id + '\')" class="text-blue-600 hover:underline text-xs mr-2">✏️ Edit</button>' +
      '<button onclick="hapusProduk(\'' + p.id + '\')" class="text-red-500 hover:underline text-xs">🗑️</button></td></tr>';
  }).join('');

  var low = POSStore.getProducts().filter(function (p) { return p.stok <= p.minStok; });
  document.getElementById('lowStockAlert').innerHTML = low.length
    ? '<div class="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-3 mb-3">⚠️ <b>' + low.length + ' barang stok menipis:</b> ' + low.map(function (p) { return p.nama + ' (' + p.stok + ')'; }).join(', ') + '</div>'
    : '';
  renderMovesTable();
}

function renderMovesTable() {
  var tb = document.getElementById('movesTable');
  if (!tb) return;
  var list = POSStore.getMoves().slice(0, 20);
  if (!list.length) { tb.innerHTML = '<tr><td colspan="6" class="text-center text-slate-400 text-sm py-4">Belum ada pergerakan. Jual/beli barang untuk mencatat otomatis.</td></tr>'; return; }
  tb.innerHTML = list.map(function (m) {
    var tag = m.tipe === 'masuk' ? '<span class="badge-green">Masuk +</span>' : '<span class="badge-red">Keluar −</span>';
    return '<tr><td class="text-xs">' + POSStore.formatTanggal(m.tanggal) + '</td>' +
      '<td class="text-xs font-semibold">' + (m.nama || '-') + '</td><td>' + tag + '</td>' +
      '<td class="font-bold">' + m.qty + '</td>' +
      '<td class="text-xs">' + m.stokSebelum + ' → ' + m.stokSesudah + '</td>' +
      '<td class="font-mono text-[11px] text-slate-400">' + (m.refId || '') + '</td></tr>';
  }).join('');
}

function openProdukModal(id) {
  editingId = id || null;
  document.getElementById('modalTitle').textContent = id ? 'Edit Barang' : 'Tambah Barang';
  if (id) {
    var p = POSStore.getProducts().find(function (x) { return x.id === id; });
    document.getElementById('fId').value = p.id;
    document.getElementById('fNama').value = p.nama;
    document.getElementById('fSku').value = p.sku;
    document.getElementById('fKategori').value = p.kategori;
    document.getElementById('fBeli').value = p.hargaBeli;
    document.getElementById('fJual').value = p.hargaJual;
    document.getElementById('fStok').value = p.stok;
    document.getElementById('fMin').value = p.minStok;
  } else {
    ['fId', 'fNama', 'fSku', 'fKategori', 'fBeli', 'fJual', 'fStok'].forEach(function (i) { document.getElementById(i).value = ''; });
    document.getElementById('fMin').value = 10;
  }
  document.getElementById('produkModal').classList.remove('hidden');
}

function closeProdukModal() { document.getElementById('produkModal').classList.add('hidden'); }

function simpanProdukModal() {
  var nama = document.getElementById('fNama').value.trim();
  var sku = document.getElementById('fSku').value.trim();
  var kat = document.getElementById('fKategori').value.trim() || 'Lainnya';
  var hb = Number(document.getElementById('fBeli').value) || 0;
  var hj = Number(document.getElementById('fJual').value) || 0;
  var stok = Number(document.getElementById('fStok').value) || 0;
  var min = Number(document.getElementById('fMin').value) || 0;
  if (!nama || hb <= 0 || hj <= 0) return toast('Nama, harga beli & jual wajib diisi!');

  var products = POSStore.getProducts();
  if (editingId) {
    var p = products.find(function (x) { return x.id === editingId; });
    Object.assign(p, { nama: nama, sku: sku || p.sku, kategori: kat, hargaBeli: hb, hargaJual: hj, stok: stok, minStok: min });
  } else {
    products.push({ id: POSStore.uid('BRG'), sku: sku || ('SKU-' + String(products.length + 1).padStart(3, '0')), nama: nama, kategori: kat, hargaBeli: hb, hargaJual: hj, stok: stok, satuan: 'pcs', minStok: min });
  }
  POSStore.setProducts(products);
  closeProdukModal();
  renderStokTable(); renderKasirGrid(); refreshBeliProdukOptions(); refreshStats();
  toast('Barang tersimpan ✓');
}

async function hapusProduk(id) {
  var p = POSStore.getProducts().find(function (x) { return x.id === id; });
  var ok = await UI.confirm({
    title: 'Hapus barang?',
    message: '"' + (p ? p.nama : id) + '" akan dihapus permanen dari master barang.',
    confirmText: 'Ya, hapus',
    tone: 'danger'
  });
  if (!ok) return;
  POSStore.setProducts(POSStore.getProducts().filter(function (p) { return p.id !== id; }));
  renderStokTable(); renderKasirGrid(); refreshBeliProdukOptions(); refreshStats();
  toast('Barang dihapus.');
}
