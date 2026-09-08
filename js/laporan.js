/* ============================================================
 * Laporan Keuangan OTOMATIS (dari penjualan & pembelian)
 * - Laba Rugi : Pendapatan − HPP = Laba Kotor (− beban = bersih)
 * - Arus Kas   : Kas Masuk (tunai/bank) − Kas Keluar = Saldo Akhir
 * - Neraca     : Aset (kas + persediaan) = Kewajiban + Ekuitas
 * Filter: Hari Ini | Bulan Ini | Custom (rentang tanggal).
 * ============================================================ */
var lapTab = 'labarugi';
var lapPreset = 'bulan';

function initLaporan() {
  if (!document.getElementById('lapDari').dataset.bound) {
    document.getElementById('lapDari').dataset.bound = '1';
    document.querySelectorAll('#lapTabs .lap-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('#lapTabs .lap-tab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        lapTab = b.dataset.tab;
        renderLaporan();
      });
    });
    document.querySelectorAll('#lapPresets .preset-btn').forEach(function (b) {
      b.addEventListener('click', function () { setLapPreset(b.dataset.preset); });
    });
    document.getElementById('lapDari').addEventListener('change', renderLaporan);
    document.getElementById('lapSampai').addEventListener('change', renderLaporan);
  }
  setLapPreset('bulan', true);
}

/* ---------- Filter rentang tanggal ---------- */

function fmtDateInput(d) { return d.toISOString().slice(0, 10); }

function setLapPreset(p, silent) {
  lapPreset = p;
  var now = new Date();
  var dari, sampai;
  if (p === 'hari') {
    dari = fmtDateInput(now); sampai = fmtDateInput(now);
  } else if (p === 'bulan') {
    dari = fmtDateInput(new Date(now.getFullYear(), now.getMonth(), 1)); sampai = fmtDateInput(now);
  } else {
    // custom: tampilkan input tanggal, pakai nilai yg ada / default bulan ini
    if (!document.getElementById('lapDari').value) {
      document.getElementById('lapDari').value = fmtDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
      document.getElementById('lapSampai').value = fmtDateInput(now);
    }
  }
  if (dari) {
    document.getElementById('lapDari').value = dari;
    document.getElementById('lapSampai').value = sampai;
  }
  document.getElementById('lapCustomDates').classList.toggle('hidden', p !== 'custom');
  document.getElementById('lapCustomDates').classList.toggle('flex', p === 'custom');
  document.querySelectorAll('#lapPresets .preset-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.preset === p);
  });
  if (!silent) renderLaporan();
}

function lapRange() {
  var d = document.getElementById('lapDari').value;
  var s = document.getElementById('lapSampai').value;
  return {
    dari: d ? new Date(d + 'T00:00:00') : new Date('2000-01-01'),
    sampai: s ? new Date(s + 'T23:59:59') : new Date()
  };
}

function periodeLabel() {
  var d = document.getElementById('lapDari').value;
  var s = document.getElementById('lapSampai').value;
  var nama = lapPreset === 'hari' ? 'Hari Ini' : lapPreset === 'bulan' ? 'Bulan Ini' : 'Custom';
  return nama + ' • ' + d + ' s/d ' + s;
}

/* ---------- Sumber data ---------- */

function txInRange() {
  var r = lapRange();
  return POSStore.getTransactions().filter(function (t) {
    var dt = new Date(t.tanggal);
    return dt >= r.dari && dt <= r.sampai;
  });
}

function finInRange() {
  var r = lapRange();
  return POSStore.getFinance().filter(function (f) {
    var dt = new Date(f.tanggal);
    return dt >= r.dari && dt <= r.sampai;
  });
}

function bebanInRange() {
  var r = lapRange();
  return POSStore.getExpenses().filter(function (b) {
    var dt = new Date(b.tanggal);
    return dt >= r.dari && dt <= r.sampai;
  });
}

function sumTx(tipe) {
  return txInRange().filter(function (t) { return t.tipe === tipe; })
    .reduce(function (a, t) { return a + t.total; }, 0);
}

function hitungHPP() {
  // Prioritas: snapshot totalHpp saat checkout. Fallback: data lama.
  var total = 0;
  var products = POSStore.getProducts();
  txInRange().filter(function (t) { return t.tipe === 'penjualan'; }).forEach(function (t) {
    if (t.totalHpp != null) { total += t.totalHpp; return; }
    total += POSStore.calcHppOfTx(t, products);
  });
  return total;
}

function totalBeban() {
  return bebanInRange().reduce(function (a, b) { return a + b.jumlah; }, 0);
}

/* Rincian HPP & laba per produk yg terjual pada periode */
function rincianProduk() {
  var map = {};
  var products = POSStore.getProducts();
  txInRange().filter(function (t) { return t.tipe === 'penjualan'; }).forEach(function (t) {
    (t.items || []).forEach(function (it) {
      var hpp = it.hpp;
      if (hpp == null) {
        var p = products.find(function (x) { return x.id === it.productId; });
        hpp = p ? p.hargaBeli : 0;
      }
      var r = map[it.productId] || { nama: it.nama, qty: 0, pendapatan: 0, hpp: 0 };
      r.qty += it.qty;
      r.pendapatan += it.subtotal != null ? it.subtotal : it.qty * it.harga;
      r.hpp += hpp * it.qty;
      map[it.productId] = r;
    });
  });
  return Object.keys(map).map(function (k) {
    var r = map[k];
    r.laba = r.pendapatan - r.hpp;
    r.margin = r.pendapatan > 0 ? Math.round(r.laba / r.pendapatan * 100) : 0;
    return r;
  }).sort(function (a, b) { return b.pendapatan - a.pendapatan; });
}

/* ---------- Komponen tampilan ---------- */

function kpiRow(cards) {
  return '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">' + cards.map(function (c) {
    return '<div class="kpi border-l-4 ' + c.border + '">' +
      '<p class="kpi-label">' + c.label + '</p>' +
      '<p class="kpi-value ' + (c.color || '') + '">' + c.value + '</p>' +
      (c.sub ? '<p class="kpi-sub">' + c.sub + '</p>' : '') + '</div>';
  }).join('') + '</div>';
}

function reportHead(judul) {
  return '<h3 class="font-extrabold text-lg text-center">TOKO KASIRKU</h3>' +
    '<h4 class="font-bold text-center text-slate-700">' + judul + '</h4>' +
    '<p class="text-center text-xs text-slate-500 mb-5">Periode: ' + periodeLabel() + '</p>';
}

function renderLaporan() {
  var box = document.getElementById('lapContent');
  if (!box) return;
  if (lapTab === 'labarugi') box.innerHTML = viewLabaRugi();
  else if (lapTab === 'neraca') box.innerHTML = viewNeraca();
  else box.innerHTML = viewArusKas();
}

/* ================= 1. LABA RUGI ================= */

function viewLabaRugi() {
  var R = POSStore.formatRupiah;
  var jual = txInRange().filter(function (t) { return t.tipe === 'penjualan'; });
  var pendapatan = jual.reduce(function (a, t) { return a + t.total; }, 0);
  var hpp = hitungHPP();
  var kotor = pendapatan - hpp;
  var beban = bebanInRange();
  var totBeban = beban.reduce(function (a, b) { return a + b.jumlah; }, 0);
  var bersih = kotor - totBeban;

  var kpi = kpiRow([
    { label: 'Total Pendapatan', value: R(pendapatan), sub: jual.length + ' transaksi penjualan', border: 'border-blue-500' },
    { label: 'Total HPP', value: R(hpp), sub: 'Harga pokok barang terjual', border: 'border-amber-500', color: 'text-amber-600' },
    { label: 'Laba Kotor', value: R(kotor), sub: 'Pendapatan − HPP', border: 'border-green-500', color: kotor >= 0 ? 'text-green-600' : 'text-red-600' }
  ]);

  var rowsBeban = beban.length ? beban.map(function (b) {
    return '<tr><td>' + b.nama + '</td><td class="text-right text-red-600">(' + R(b.jumlah) + ')</td></tr>';
  }).join('') : '<tr><td colspan="2" class="text-center text-slate-400 text-xs py-2">Tidak ada beban pada periode ini.</td></tr>';

  var det = rincianProduk();
  var detRows = det.length ? det.map(function (r, i) {
    return '<tr><td class="text-slate-400">' + (i + 1) + '</td><td class="font-semibold">' + r.nama + '</td>' +
      '<td class="text-center">' + r.qty + '</td><td class="text-right">' + R(r.pendapatan) + '</td>' +
      '<td class="text-right">' + R(r.hpp) + '</td>' +
      '<td class="text-right font-bold ' + (r.laba >= 0 ? 'text-green-700' : 'text-red-600') + '">' + R(r.laba) + '</td>' +
      '<td class="text-center"><span class="badge-green">' + r.margin + '%</span></td></tr>';
  }).join('') : '<tr><td colspan="7" class="text-center text-slate-400 text-xs py-3">Belum ada penjualan pada periode ini.</td></tr>';

  return kpi +
    '<div class="bg-white rounded-2xl shadow-sm border p-5 md:p-8 max-w-3xl">' + reportHead('LAPORAN LABA RUGI') +
    '<table class="table"><tbody>' +
    '<tr><td class="font-semibold">Total Pendapatan Penjualan</td><td class="text-right font-bold">' + R(pendapatan) + '</td></tr>' +
    '<tr><td class="text-slate-600">Total HPP (barang terjual)</td><td class="text-right text-red-600">(' + R(hpp) + ')</td></tr>' +
    '<tr class="bg-green-50"><td class="font-bold">Laba Kotor</td><td class="text-right font-extrabold text-green-700">' + R(kotor) + '</td></tr>' +
    '</tbody></table>' +
    '<p class="font-semibold text-sm mt-5 mb-1">Beban Operasional</p>' +
    '<table class="table"><tbody>' + rowsBeban +
    '<tr class="font-semibold"><td>Total Beban</td><td class="text-right text-red-600">(' + R(totBeban) + ')</td></tr>' +
    '</tbody></table>' +
    '<div class="flex justify-between font-extrabold text-lg py-3 px-4 mt-4 rounded-xl ' + (bersih >= 0 ? 'bg-blue-600 text-white' : 'bg-red-600 text-white') + '"><span>Laba Bersih</span><span>' + R(bersih) + '</span></div>' +
    tambahBebanForm() + '</div>' +
    '<div class="bg-white rounded-2xl shadow-sm border p-5 md:p-6 mt-4 max-w-3xl">' +
    '<h4 class="font-bold text-sm mb-1">📦 Rincian HPP & Laba per Produk</h4>' +
    '<p class="text-xs text-slate-500 mb-3">Otomatis dari barang yang terjual pada periode ini.</p>' +
    '<div class="overflow-x-auto"><table class="table"><thead><tr><th>No</th><th>Produk</th><th>Terjual</th><th>Pendapatan</th><th>HPP</th><th>Laba</th><th>Margin</th></tr></thead>' +
    '<tbody>' + detRows + '</tbody></table></div></div>';
}

function tambahBebanForm() {
  return '<div class="mt-5 bg-slate-50 border rounded-xl p-3"><p class="text-sm font-semibold mb-2">+ Tambah beban operasional</p>' +
    '<div class="flex flex-col sm:flex-row gap-2">' +
    '<input id="bebanNama" class="inp flex-1" placeholder="cth: Gaji, Sewa...">' +
    '<input id="bebanJumlah" type="number" class="inp sm:w-40" placeholder="Jumlah Rp">' +
    '<button onclick="simpanBeban()" class="bg-slate-900 text-white text-sm font-semibold px-4 rounded-xl">Simpan</button></div></div>';
}

function simpanBeban() {
  var nama = document.getElementById('bebanNama').value.trim();
  var jml = Number(document.getElementById('bebanJumlah').value) || 0;
  if (!nama || jml <= 0) return toast('Isi nama & jumlah beban!');
  var bbn = { id: POSStore.uid('BBN'), tanggal: new Date().toISOString(), nama: nama, jumlah: jml, akunKode: '6-120' };
  var arr = POSStore.getExpenses();
  arr.unshift(bbn);
  POSStore.setExpenses(arr);
  // Jurnal otomatis: beban = kas keluar
  POSStore.recordFinance({
    tanggal: bbn.tanggal, arus: 'keluar', kategori: 'beban',
    jumlah: jml, metode: 'Tunai', akunKode: '6-120',
    refId: bbn.id, keterangan: nama
  });
  renderLaporan(); refreshStats();
  if (typeof renderKeuangan === 'function') renderKeuangan();
  toast('Beban tercatat ✓ (kas berkurang)');
}

/* ================= 2. ARUS KAS ================= */

function viewArusKas() {
  var R = POSStore.formatRupiah;
  var r = lapRange();

  // Saldo awal kas = saldo awal akun + seluruh mutasi SEBELUM periode
  var acc = POSStore.getAccounts();
  var kasAwalAkun = (acc.find(function (a) { return a.kode === '1-100'; }) || { saldoAwal: 0 }).saldoAwal;
  var allFin = POSStore.getFinance();
  var masukSblm = 0, keluarSblm = 0;
  allFin.forEach(function (f) {
    if (new Date(f.tanggal) < r.dari) {
      if (f.arus === 'masuk') masukSblm += f.jumlah;
      else if (f.arus === 'keluar') keluarSblm += f.jumlah;
    }
  });
  var saldoAwal = kasAwalAkun + masukSblm - keluarSblm;

  var fin = allFin.filter(function (f) {
    var dt = new Date(f.tanggal);
    return dt >= r.dari && dt <= r.sampai;
  });
  var masuk = fin.filter(function (f) { return f.arus === 'masuk'; });
  var keluarKas = fin.filter(function (f) { return f.arus === 'keluar'; });
  var hutang = fin.filter(function (f) { return f.arus === 'hutang'; });

  var tunai = masuk.filter(function (f) { return (f.metode || 'Tunai') === 'Tunai'; })
    .reduce(function (a, f) { return a + f.jumlah; }, 0);
  var nonTunai = masuk.filter(function (f) { return (f.metode || 'Tunai') !== 'Tunai'; })
    .reduce(function (a, f) { return a + f.jumlah; }, 0);
  var totMasuk = tunai + nonTunai;
  var totBeli = keluarKas.filter(function (f) { return f.kategori === 'pembelian'; }).reduce(function (a, f) { return a + f.jumlah; }, 0);
  var totBeban = keluarKas.filter(function (f) { return f.kategori === 'beban'; }).reduce(function (a, f) { return a + f.jumlah; }, 0);
  var totLunas = keluarKas.filter(function (f) { return f.kategori === 'pelunasan-hutang'; }).reduce(function (a, f) { return a + f.jumlah; }, 0);
  var totKeluar = totBeli + totBeban + totLunas;
  var mutasi = totMasuk - totKeluar;
  var saldoAkhir = saldoAwal + mutasi;
  var totHutang = hutang.reduce(function (a, f) { return a + f.jumlah; }, 0);
  var nBeli = keluarKas.filter(function (f) { return f.kategori === 'pembelian'; }).length;

  var kpi = kpiRow([
    { label: 'Kas Masuk', value: R(totMasuk), sub: masuk.length + ' pemasukan (tunai + bank)', border: 'border-green-500', color: 'text-green-600' },
    { label: 'Kas Keluar', value: R(totKeluar), sub: 'Restok + beban + pelunasan', border: 'border-red-500', color: 'text-red-600' },
    { label: 'Saldo Kas Akhir', value: R(saldoAkhir), sub: 'Saldo awal + mutasi bersih', border: 'border-blue-500' }
  ]);

  return kpi +
    '<div class="bg-white rounded-2xl shadow-sm border p-5 md:p-8 max-w-3xl">' + reportHead('LAPORAN ARUS KAS') +
    '<table class="table"><tbody>' +
    '<tr><td class="font-semibold">Saldo Kas Awal Periode</td><td class="text-right font-bold">' + R(saldoAwal) + '</td></tr>' +
    '</tbody></table>' +
    '<p class="font-bold text-green-700 text-sm mt-4 mb-1">💰 ARUS KAS MASUK — ' + R(totMasuk) + '</p>' +
    '<table class="table"><tbody>' +
    '<tr><td>Penjualan Tunai 💵</td><td class="text-right font-semibold text-green-700">' + R(tunai) + '</td></tr>' +
    '<tr><td>Penjualan Non-Tunai (QRIS / Transfer) 🏦</td><td class="text-right">' + R(nonTunai) + '</td></tr>' +
    '</tbody></table>' +
    '<p class="font-bold text-red-700 text-sm mt-4 mb-1">💸 ARUS KAS KELUAR — ' + R(totKeluar) + '</p>' +
    '<table class="table"><tbody>' +
    '<tr><td>Pembelian / Restok barang (' + nBeli + ' transaksi)</td><td class="text-right">(' + R(totBeli) + ')</td></tr>' +
    '<tr><td>Beban operasional</td><td class="text-right">(' + R(totBeban) + ')</td></tr>' +
    '<tr><td>Pelunasan hutang</td><td class="text-right">(' + R(totLunas) + ')</td></tr>' +
    '</tbody></table>' +
    '<table class="table mt-3"><tbody>' +
    '<tr><td class="font-semibold">Mutasi Kas Bersih</td><td class="text-right font-bold ' + (mutasi >= 0 ? 'text-green-700' : 'text-red-600') + '">' + R(mutasi) + '</td></tr>' +
    '<tr class="bg-blue-50"><td class="font-extrabold">SALDO KAS AKHIR</td><td class="text-right font-extrabold text-blue-700">' + R(saldoAkhir) + '</td></tr>' +
    '</tbody></table>' +
    '<p class="mt-3 text-xs px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-100">ℹ️ Pembelian kredit ' + R(totHutang) + ' tidak mengurangi kas — tercatat sebagai hutang di Neraca.</p>' +
    '</div>';
}

/* ================= 3. NERACA SEDERHANA ================= */

function sumAll(tipe) {
  return POSStore.getTransactions().filter(function (t) { return t.tipe === tipe; })
    .reduce(function (a, t) { return a + t.total; }, 0);
}

function hitungHPPAll() {
  var total = 0;
  var products = POSStore.getProducts();
  POSStore.getTransactions().filter(function (t) { return t.tipe === 'penjualan'; }).forEach(function (t) {
    if (t.totalHpp != null) { total += t.totalHpp; return; }
    total += POSStore.calcHppOfTx(t, products);
  });
  return total;
}

function viewNeraca() {
  var R = POSStore.formatRupiah;
  var acc = POSStore.getAccounts();
  var kasAwal = (acc.find(function (a) { return a.kode === '1-100'; }) || { saldoAwal: 0 }).saldoAwal;
  var peralatan = (acc.find(function (a) { return a.kode === '1-200'; }) || { saldoAwal: 0 }).saldoAwal;
  var utangAwal = (acc.find(function (a) { return a.kode === '2-100'; }) || { saldoAwal: 0 }).saldoAwal;
  var modalAwal = (acc.find(function (a) { return a.kode === '3-100'; }) || { saldoAwal: 0 }).saldoAwal;

  // Kas & hutang dari JURNAL (kredit → hutang, bukan kas keluar)
  var fin = POSStore.getFinance();
  var kasMasuk = fin.filter(function (f) { return f.arus === 'masuk'; }).reduce(function (a, f) { return a + f.jumlah; }, 0);
  var kasKeluar = fin.filter(function (f) { return f.arus === 'keluar'; }).reduce(function (a, f) { return a + f.jumlah; }, 0);
  var hutangJurnal = fin.filter(function (f) { return f.arus === 'hutang'; }).reduce(function (a, f) { return a + f.jumlah; }, 0);

  // ASET
  var kas = kasAwal + kasMasuk - kasKeluar;
  var persediaan = POSStore.getProducts().reduce(function (a, p) { return a + p.stok * p.hargaBeli; }, 0);
  var totalAset = kas + persediaan + peralatan;

  // KEWAJIBAN & EKUITAS (penyeimbang, AKUMULASI seluruh waktu —
  // neraca adalah potret posisi saat ini, bukan per periode)
  var utang = utangAwal + hutangJurnal;
  var pembelianAll = sumAll('pembelian');
  var hppAll = hitungHPPAll();
  var bebanAll = POSStore.getExpenses().reduce(function (a, b) { return a + b.jumlah; }, 0);
  var labaDitahan = sumAll('penjualan') - hppAll - bebanAll;
  // Stok awal (barang milik toko sebelum tercatat di sistem) adalah
  // bagian modal: persediaan saat ini − (pembelian − HPP seluruh waktu).
  var modalBarang = persediaan - (pembelianAll - hppAll);
  var totalEkuitas = modalAwal + modalBarang + labaDitahan;
  var pasiva = utang + totalEkuitas;
  var seimbang = Math.abs(totalAset - pasiva) < 1;

  var kpi = kpiRow([
    { label: 'Total Aset', value: R(totalAset), sub: 'Kas + persediaan + peralatan', border: 'border-blue-500' },
    { label: 'Kewajiban', value: R(utang), sub: 'Utang usaha', border: 'border-red-500', color: 'text-red-600' },
    { label: 'Ekuitas', value: R(totalEkuitas), sub: 'Modal + laba ditahan', border: 'border-green-500', color: 'text-green-600' }
  ]);

  function row(l, r, bold, color) {
    return '<tr class="' + (bold ? 'font-bold' : '') + '"><td>' + l + '</td>' +
      '<td class="text-right ' + (color || '') + '">' + R(r) + '</td></tr>';
  }

  return kpi + '<div class="max-w-3xl">' +
    '<h3 class="font-extrabold text-lg text-center">NERACA SEDERHANA</h3>' +
    '<p class="text-center text-xs text-slate-500 mb-4">Periode: ' + periodeLabel() + ' • posisi kas & stok saat ini</p>' +
    '<div class="grid md:grid-cols-2 gap-4">' +
    '<div class="bg-white rounded-2xl shadow-sm border p-5"><h3 class="font-extrabold mb-1">📦 ASET</h3>' +
    '<p class="text-xs font-semibold text-slate-500 mt-3 mb-1">Aset Lancar</p>' +
    '<table class="table"><tbody>' +
    row('Saldo Kas saat ini', kas) +
    row('Nilai Persediaan (stok × harga beli)', persediaan) +
    '</tbody></table>' +
    '<p class="text-xs font-semibold text-slate-500 mt-3 mb-1">Aset Tetap</p>' +
    '<table class="table"><tbody>' + row('Peralatan Toko', peralatan) +
    '<tr class="bg-blue-50 font-extrabold"><td>TOTAL ASET</td><td class="text-right text-blue-700">' + R(totalAset) + '</td></tr>' +
    '</tbody></table></div>' +
    '<div class="bg-white rounded-2xl shadow-sm border p-5"><h3 class="font-extrabold mb-1">⚖️ KEWAJIBAN & EKUITAS</h3>' +
    '<p class="text-xs font-semibold text-slate-500 mt-3 mb-1">Kewajiban</p>' +
    '<table class="table"><tbody>' + row('Utang Usaha', utang) + '</tbody></table>' +
    '<p class="text-xs font-semibold text-slate-500 mt-3 mb-1">Ekuitas (penyeimbang)</p>' +
    '<table class="table"><tbody>' +
    row('Modal Dasar', modalAwal) +
    row('Modal Barang (stok awal)', modalBarang) +
    row('Laba Ditahan (akumulasi)', labaDitahan, false, labaDitahan >= 0 ? 'text-green-700' : 'text-red-600') +
    '<tr class="bg-green-50 font-extrabold"><td>TOTAL PASIVA</td><td class="text-right text-green-700">' + R(pasiva) + '</td></tr>' +
    '</tbody></table>' +
    '<p class="mt-3 text-xs font-bold px-3 py-2 rounded-lg ' + (seimbang ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700') + '">' +
    (seimbang ? '✓ Seimbang: Aset = Kewajiban + Ekuitas' : '⚠️ Selisih ' + R(totalAset - pasiva)) + '</p></div>' +
    '</div>' +
    '<p class="mt-3 text-xs text-slate-500 bg-white border rounded-xl px-4 py-3">Rumus: <b>Aset</b> (Kas ' + R(kas) + ' + Persediaan ' + R(persediaan) + ' + Peralatan ' + R(peralatan) + ') = <b>Pasiva</b> (Utang ' + R(utang) + ' + Modal Dasar ' + R(modalAwal) + ' + Modal Barang ' + R(modalBarang) + ' + Laba Ditahan ' + R(labaDitahan) + ').</p></div>';
}
