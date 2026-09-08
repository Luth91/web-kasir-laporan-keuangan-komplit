/* ============================================================
 * Modul Keuangan — Buku Kas & Hutang
 * Semua entri ditulis OTOMATIS oleh kasir.js / pembelian.js /
 * laporan.js (beban) via POSStore.recordFinance().
 * Modul ini hanya MENAMPILKAN + melunasi hutang.
 * ============================================================ */

function initKeuangan() {
  var dari = document.getElementById('keuDari');
  var sampai = document.getElementById('keuSampai');
  if (dari && !dari.value) {
    var now = new Date();
    dari.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    sampai.value = now.toISOString().slice(0, 10);
  }
  if (dari && !dari.dataset.bound) {
    dari.dataset.bound = '1';
    dari.addEventListener('change', renderKeuangan);
    sampai.addEventListener('change', renderKeuangan);
    document.getElementById('keuSearch').addEventListener('input', renderKeuangan);
  }
  renderKeuangan();
}

function keuFiltered() {
  var d = document.getElementById('keuDari').value;
  var s = document.getElementById('keuSampai').value;
  var q = (document.getElementById('keuSearch').value || '').toLowerCase();
  var dari = d ? new Date(d + 'T00:00:00') : new Date('2000-01-01');
  var sampai = s ? new Date(s + 'T23:59:59') : new Date();
  return POSStore.getFinance().filter(function (f) {
    var dt = new Date(f.tanggal);
    var okT = dt >= dari && dt <= sampai;
    var okQ = !q || (f.keterangan || '').toLowerCase().includes(q) ||
      (f.refId || '').toLowerCase().includes(q) || (f.kategori || '').includes(q);
    return okT && okQ;
  });
}

function renderKeuangan() {
  var list = keuFiltered();
  var masuk = list.filter(function (f) { return f.arus === 'masuk'; }).reduce(function (a, f) { return a + f.jumlah; }, 0);
  var keluar = list.filter(function (f) { return f.arus === 'keluar'; }).reduce(function (a, f) { return a + f.jumlah; }, 0);
  var hutangPeriode = list.filter(function (f) { return f.arus === 'hutang'; }).reduce(function (a, f) { return a + f.jumlah; }, 0);

  document.getElementById('keuMasuk').textContent = POSStore.formatRupiah(masuk);
  document.getElementById('keuKeluar').textContent = POSStore.formatRupiah(keluar);
  document.getElementById('keuSaldoKas').textContent = POSStore.formatRupiah(POSStore.getSaldoKas());
  document.getElementById('keuHutang').textContent = POSStore.formatRupiah(POSStore.getSaldoHutang());
  document.getElementById('keuNett').textContent =
    POSStore.formatRupiah(masuk - keluar) + ' • Hutang periode ' + POSStore.formatRupiah(hutangPeriode);

  var tb = document.getElementById('keuTable');
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="6" class="text-center text-slate-400 text-sm py-4">Belum ada jurnal pada filter ini.</td></tr>';
    return;
  }
  tb.innerHTML = list.slice(0, 100).map(function (f) {
    var badge = f.arus === 'masuk'
      ? '<span class="badge-green">Kas Masuk</span>'
      : f.arus === 'keluar' ? '<span class="badge-red">Kas Keluar</span>' : '<span class="badge">Hutang</span>';
    var jml = (f.arus === 'masuk' ? '+' : '−') + POSStore.formatRupiah(f.jumlah);
    var aksi = f.arus === 'hutang'
      ? '<button onclick="lunasiHutang(\'' + f.id + '\')" class="text-xs text-green-600 hover:underline font-semibold">Lunasi</button>'
      : '<span class="text-xs text-slate-300">otomatis</span>';
    return '<tr><td class="text-xs">' + POSStore.formatTanggal(f.tanggal) + '</td>' +
      '<td>' + badge + '<div class="text-[11px] text-slate-400">' + f.kategori + ' • ' + (f.metode || '-') + '</div></td>' +
      '<td class="text-xs">' + (f.keterangan || '-') + '<div class="font-mono text-[11px] text-slate-400">' + (f.refId || '') + '</div></td>' +
      '<td class="font-bold text-sm whitespace-nowrap">' + jml + '</td>' +
      '<td class="font-mono text-xs">' + (f.akunKode || '-') + '</td>' +
      '<td>' + aksi + '</td></tr>';
  }).join('');
}

/* Pelunasan hutang pembelian kredit -> kas keluar + hutang berkurang.
   Implementasi: tambah jurnal kas keluar ber-ref hutang tsb, dan tandai
   jurnal hutang asal sebagai lunas (tidak dihitung lagi). */
async function lunasiHutang(financeId) {
  var fin = POSStore.getFinance();
  var h = fin.find(function (f) { return f.id === financeId; });
  if (!h || h.arus !== 'hutang') return;
  if (h.lunas) return toast('Hutang ini sudah lunas.');
  var ok = await UI.confirm({
    title: 'Lunasi hutang?',
    message: POSStore.formatRupiah(h.jumlah) + ' (' + (h.refId || '') + ') akan dibayar dari kas.',
    confirmText: 'Ya, lunasi',
    tone: 'primary'
  });
  if (!ok) return;
  h.lunas = true;
  // tandai lunas agar tidak dihitung sebagai hutang berjalan
  h.arus = 'hutang-lunas';
  POSStore.setFinance(fin);
  POSStore.recordFinance({
    tanggal: new Date().toISOString(),
    arus: 'keluar', kategori: 'pelunasan-hutang', jumlah: h.jumlah,
    metode: 'Tunai', akunKode: '2-100', refId: h.refId,
    keterangan: 'Pelunasan hutang ' + (h.refId || '')
  });
  renderKeuangan(); renderLaporan(); refreshStats();
  toast('Hutang dilunasi, kas berkurang ✓');
}
