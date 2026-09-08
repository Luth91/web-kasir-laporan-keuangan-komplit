/* ============================================================
 * POS Store — LocalStorage wrapper + data sampel awal
 * Keys:
 *   pos_products      : master barang
 *   pos_transactions  : penjualan & pembelian
 *   pos_finance       : jurnal keuangan (kas masuk/keluar, hutang)
 *   pos_stock_moves   : riwayat keluar-masuk barang (audit trail)
 *   pos_accounts      : bagan akun keuangan (CoA)
 *   pos_expenses      : beban operasional
 *   pos_initialized   : flag seeding
 * ============================================================ */
(function (global) {
  'use strict';

  var KEYS = {
    products: 'pos_products',
    transactions: 'pos_transactions',
    finance: 'pos_finance',
    stockMoves: 'pos_stock_moves',
    accounts: 'pos_accounts',
    expenses: 'pos_expenses',
    initialized: 'pos_initialized_v2'
  };

  var OLD_FLAG = 'pos_initialized_v1';

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Gagal membaca ' + key, e);
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid(prefix) {
    return (prefix || 'ID') + '-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 999);
  }

  function todayISO(offsetDays) {
    var d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    return d.toISOString();
  }

  /* ---------- DATA SAMPEL ---------- */

  function seedProducts() {
    return [
      { id: 'BRG-001', sku: 'SKU-001', nama: 'Indomie Goreng', kategori: 'Makanan', hargaBeli: 2800, hargaJual: 3500, stok: 120, satuan: 'pcs', minStok: 20 },
      { id: 'BRG-002', sku: 'SKU-002', nama: 'Aqua 600ml', kategori: 'Minuman', hargaBeli: 2500, hargaJual: 3500, stok: 200, satuan: 'btl', minStok: 30 },
      { id: 'BRG-003', sku: 'SKU-003', nama: 'Kopi Kapal Api 25g', kategori: 'Minuman', hargaBeli: 1800, hargaJual: 2500, stok: 150, satuan: 'pcs', minStok: 25 },
      { id: 'BRG-004', sku: 'SKU-004', nama: 'Beras 5kg Cap Lele', kategori: 'Sembako', hargaBeli: 62000, hargaJual: 70000, stok: 25, satuan: 'karung', minStok: 5 },
      { id: 'BRG-005', sku: 'SKU-005', nama: 'Minyak Goreng 2L', kategori: 'Sembako', hargaBeli: 38000, hargaJual: 44000, stok: 40, satuan: 'pcs', minStok: 8 },
      { id: 'BRG-006', sku: 'SKU-006', nama: 'Gula Pasir 1kg', kategori: 'Sembako', hargaBeli: 16500, hargaJual: 19000, stok: 60, satuan: 'pcs', minStok: 10 },
      { id: 'BRG-007', sku: 'SKU-007', nama: 'Teh Botol Sosro 450ml', kategori: 'Minuman', hargaBeli: 3200, hargaJual: 4500, stok: 8, satuan: 'btl', minStok: 24 },
      { id: 'BRG-008', sku: 'SKU-008', nama: 'Chitato Sapi Panggang 68g', kategori: 'Snack', hargaBeli: 9500, hargaJual: 12000, stok: 75, satuan: 'pcs', minStok: 15 },
      { id: 'BRG-009', sku: 'SKU-009', nama: 'Sabun Lifebuoy 100g', kategori: 'ATK & Rumah', hargaBeli: 4500, hargaJual: 6000, stok: 50, satuan: 'pcs', minStok: 12 },
      { id: 'BRG-010', sku: 'SKU-010', nama: 'Pulpen Pilot Hitam', kategori: 'ATK & Rumah', hargaBeli: 2500, hargaJual: 4000, stok: 100, satuan: 'pcs', minStok: 20 }
    ];
  }

  function seedAccounts() {
    // Bagan Akun (Chart of Accounts) — format standar laporan keuangan
    return [
      { kode: '1-100', nama: 'Kas & Bank', tipe: 'Aset', subtipe: 'Aset Lancar', saldoAwal: 15000000 },
      { kode: '1-110', nama: 'Persediaan Barang', tipe: 'Aset', subtipe: 'Aset Lancar', saldoAwal: 0 },
      { kode: '1-120', nama: 'Piutang Usaha', tipe: 'Aset', subtipe: 'Aset Lancar', saldoAwal: 0 },
      { kode: '1-200', nama: 'Peralatan Toko', tipe: 'Aset', subtipe: 'Aset Tetap', saldoAwal: 5000000 },
      { kode: '2-100', nama: 'Utang Usaha', tipe: 'Kewajiban', subtipe: 'Kewajiban Jangka Pendek', saldoAwal: 2000000 },
      { kode: '3-100', nama: 'Modal Pemilik', tipe: 'Modal', subtipe: 'Modal', saldoAwal: 18000000 },
      { kode: '4-100', nama: 'Pendapatan Penjualan', tipe: 'Pendapatan', subtipe: 'Pendapatan', saldoAwal: 0 },
      { kode: '5-100', nama: 'Harga Pokok Penjualan (HPP)', tipe: 'Beban', subtipe: 'Beban Pokok', saldoAwal: 0 },
      { kode: '6-100', nama: 'Beban Sewa', tipe: 'Beban', subtipe: 'Beban Operasional', saldoAwal: 0 },
      { kode: '6-110', nama: 'Beban Gaji', tipe: 'Beban', subtipe: 'Beban Operasional', saldoAwal: 0 },
      { kode: '6-120', nama: 'Beban Listrik & Air', tipe: 'Beban', subtipe: 'Beban Operasional', saldoAwal: 0 }
    ];
  }

  function seedExpenses() {
    return [
      { id: 'BBN-001', tanggal: todayISO(-6), nama: 'Sewa toko (pro-rata mingguan)', jumlah: 500000, akunKode: '6-100' },
      { id: 'BBN-002', tanggal: todayISO(-3), nama: 'Gaji karyawan mingguan', jumlah: 750000, akunKode: '6-110' },
      { id: 'BBN-003', tanggal: todayISO(-1), nama: 'Listrik & air', jumlah: 250000, akunKode: '6-120' }
    ];
  }

  function seedTransactions() {
    // Beberapa penjualan & pembelian sampel (7 hari terakhir)
    var tx = [];
    var jual = [
      { hari: 0, items: [['BRG-001', 4], ['BRG-002', 3]], metode: 'Tunai' },
      { hari: 0, items: [['BRG-005', 1], ['BRG-006', 2]], metode: 'QRIS' },
      { hari: -1, items: [['BRG-004', 2], ['BRG-003', 10]], metode: 'Tunai' },
      { hari: -2, items: [['BRG-008', 5], ['BRG-007', 6]], metode: 'Transfer' },
      { hari: -3, items: [['BRG-001', 10], ['BRG-002', 10]], metode: 'Tunai' },
      { hari: -5, items: [['BRG-006', 5], ['BRG-009', 4]], metode: 'QRIS' }
    ];
    var priceMap = {};
    seedProducts().forEach(function (p) { priceMap[p.id] = p; });

    jual.forEach(function (s, i) {
      var items = s.items.map(function (pair) {
        var p = priceMap[pair[0]];
        return { productId: p.id, nama: p.nama, qty: pair[1], harga: p.hargaJual, hpp: p.hargaBeli, subtotal: pair[1] * p.hargaJual };
      });
      var total = items.reduce(function (a, b) { return a + b.subtotal; }, 0);
      var totalHpp = items.reduce(function (a, b) {
        var p = priceMap[b.productId];
        return a + (b.qty * p.hargaBeli);
      }, 0);
      tx.push({
        id: 'JUAL-2026-' + (100 + i),
        tanggal: todayISO(s.hari),
        tipe: 'penjualan',
        items: items,
        total: total,
        totalHpp: totalHpp,
        totalLaba: total - totalHpp,
        bayar: total,
        kembalian: 0,
        metode: s.metode,
        kasir: 'Admin',
        keterangan: 'Transaksi sampel'
      });
    });

    tx.push({
      id: 'BELI-2026-101',
      tanggal: todayISO(-4),
      tipe: 'pembelian',
      items: [{ productId: 'BRG-001', nama: 'Indomie Goreng', qty: 100, harga: 2800, subtotal: 280000 }],
      total: 280000, bayar: 280000, kembalian: 0,
      metode: 'Transfer', supplier: 'Distributor ABC', keterangan: 'Restok sampel'
    });
    tx.push({
      id: 'BELI-2026-102',
      tanggal: todayISO(-2),
      tipe: 'pembelian',
      items: [{ productId: 'BRG-002', nama: 'Aqua 600ml', qty: 120, harga: 2500, subtotal: 300000 }],
      total: 300000, bayar: 300000, kembalian: 0,
      metode: 'Tunai', supplier: 'Agen XYZ', keterangan: 'Restok sampel'
    });
    return tx;
  }

  /* ---------- JURNAL KEUANGAN (otomatis dari transaksi) ----------
   * Entry: { id, tanggal, arus: 'masuk'|'keluar', kategori,
   *   jumlah, metode, akunKode, refId, keterangan }
   * Aturan:
   *  - Penjualan (Tunai/QRIS/Transfer) -> kas MASUK.
   *  - Pembelian Tunai/Transfer/QRIS   -> kas KELUAR.
   *  - Pembelian Kredit                -> HUTANG (kas tidak berkurang).
   *  - Beban                           -> kas KELUAR.
   * --------------------------------------------------------------- */
  function financeFromTransactions(transactions, expenses) {
    var out = [];
    (transactions || []).forEach(function (t) {
      if (t.tipe === 'penjualan') {
        out.push({
          id: 'KM-' + t.id, tanggal: t.tanggal, arus: 'masuk',
          kategori: 'penjualan', jumlah: t.total, metode: t.metode || 'Tunai',
          akunKode: '1-100', refId: t.id,
          keterangan: 'Pemasukan kas dari ' + t.id
        });
      } else if (t.tipe === 'pembelian') {
        var isKredit = (t.metode === 'Kredit');
        out.push({
          id: (isKredit ? 'HT-' : 'KK-') + t.id, tanggal: t.tanggal,
          arus: isKredit ? 'hutang' : 'keluar',
          kategori: 'pembelian', jumlah: t.total, metode: t.metode || 'Tunai',
          akunKode: isKredit ? '2-100' : '1-100', refId: t.id,
          keterangan: (isKredit ? 'Hutang ke ' : 'Pengeluaran kas ') + (t.supplier || '') + ' (' + t.id + ')'
        });
      }
    });
    (expenses || []).forEach(function (b) {
      out.push({
        id: 'KK-' + b.id, tanggal: b.tanggal, arus: 'keluar',
        kategori: 'beban', jumlah: b.jumlah, metode: 'Tunai',
        akunKode: b.akunKode || '6-120', refId: b.id, keterangan: b.nama
      });
    });
    out.sort(function (a, b) { return new Date(b.tanggal) - new Date(a.tanggal); });
    return out;
  }

  function seedIfNeeded() {
    // Migrasi: user lama (flag v1) -> bangun finance + stockMoves dari data yg ada
    if (localStorage.getItem(KEYS.initialized)) return false;
    if (localStorage.getItem(OLD_FLAG) && !localStorage.getItem(KEYS.finance)) {
      var tx = load(KEYS.transactions, []);
      var exp = load(KEYS.expenses, []);
      save(KEYS.finance, financeFromTransactions(tx, exp));
      save(KEYS.stockMoves, []);
      localStorage.setItem(KEYS.initialized, '1');
      return true;
    }
    save(KEYS.products, seedProducts());
    var txSeed = seedTransactions();
    var expSeed = seedExpenses();
    save(KEYS.transactions, txSeed);
    save(KEYS.accounts, seedAccounts());
    save(KEYS.expenses, expSeed);
    save(KEYS.finance, financeFromTransactions(txSeed, expSeed));
    save(KEYS.stockMoves, []);
    localStorage.setItem(KEYS.initialized, '1');
    return true;
  }

  function resetDemo() {
    [KEYS.products, KEYS.transactions, KEYS.finance, KEYS.stockMoves,
     KEYS.accounts, KEYS.expenses, KEYS.initialized, OLD_FLAG].forEach(function (k) {
      localStorage.removeItem(k);
    });
    seedIfNeeded();
  }

  /* ---------- Helper HPP / Laba ---------- */
  function calcHppOfTx(t, products) {
    if (t.totalHpp != null) return t.totalHpp;
    var total = 0;
    (t.items || []).forEach(function (it) {
      var hpp = it.hpp;
      if (hpp == null && products) {
        var p = products.find(function (x) { return x.id === it.productId; });
        hpp = p ? p.hargaBeli : 0;
      }
      total += (hpp || 0) * it.qty;
    });
    return total;
  }

  global.POSStore = {
    KEYS: KEYS,
    load: load,
    save: save,
    uid: uid,
    getProducts: function () { return load(KEYS.products, []); },
    setProducts: function (v) { save(KEYS.products, v); },
    getTransactions: function () { return load(KEYS.transactions, []); },
    setTransactions: function (v) { save(KEYS.transactions, v); },
    getFinance: function () { return load(KEYS.finance, []); },
    setFinance: function (v) { save(KEYS.finance, v); },
    getMoves: function () { return load(KEYS.stockMoves, []); },
    setMoves: function (v) { save(KEYS.stockMoves, v); },
    getAccounts: function () { return load(KEYS.accounts, []); },
    setAccounts: function (v) { save(KEYS.accounts, v); },
    getExpenses: function () { return load(KEYS.expenses, []); },
    setExpenses: function (v) { save(KEYS.expenses, v); },
    financeFromTransactions: financeFromTransactions,
    calcHppOfTx: calcHppOfTx,
    recordFinance: function (entry) {
      var arr = load(KEYS.finance, []);
      arr.unshift(Object.assign({ id: uid('JRN'), tanggal: new Date().toISOString() }, entry));
      save(KEYS.finance, arr);
      return arr[0];
    },
    removeFinanceByRef: function (refId) {
      save(KEYS.finance, load(KEYS.finance, []).filter(function (f) { return f.refId !== refId; }));
    },
    logStockMove: function (move) {
      var arr = load(KEYS.stockMoves, []);
      arr.unshift(Object.assign({ id: uid('MV'), tanggal: new Date().toISOString() }, move));
      save(KEYS.stockMoves, arr.slice(0, 500)); // batasi 500 terakhir
      return arr[0];
    },
    getSaldoKas: function () {
      var acc = load(KEYS.accounts, []).find(function (a) { return a.kode === '1-100'; });
      var awal = acc ? acc.saldoAwal : 0;
      var fin = load(KEYS.finance, []);
      var masuk = fin.filter(function (f) { return f.arus === 'masuk'; }).reduce(function (a, f) { return a + f.jumlah; }, 0);
      var keluar = fin.filter(function (f) { return f.arus === 'keluar'; }).reduce(function (a, f) { return a + f.jumlah; }, 0);
      return awal + masuk - keluar;
    },
    getSaldoHutang: function () {
      var acc = load(KEYS.accounts, []).find(function (a) { return a.kode === '2-100'; });
      var awal = acc ? acc.saldoAwal : 0;
      var hutang = load(KEYS.finance, []).filter(function (f) { return f.arus === 'hutang'; })
        .reduce(function (a, f) { return a + f.jumlah; }, 0);
      return awal + hutang;
    },
    seedIfNeeded: seedIfNeeded,
    resetDemo: resetDemo,
    formatRupiah: function (n) {
      n = Number(n) || 0;
      return 'Rp ' + n.toLocaleString('id-ID');
    },
    formatTanggal: function (iso) {
      try { return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); }
      catch (e) { return iso; }
    }
  };
})(window);
