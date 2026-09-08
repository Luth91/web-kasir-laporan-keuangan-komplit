# KasirKu — POS + Laporan Keuangan (Tahap 1)

Aplikasi kasir sederhana: **HTML + Tailwind CDN + Vanilla JS + LocalStorage**.
Tanpa install, tanpa database, langsung jalan di browser.

## Struktur proyek

```
Kasir-Laporan-Keuangan/
├── index.html        # Dashboard + sidebar (Kasir, Pembelian, Stok, Laporan)
├── css/
│   └── style.css     # Style tambahan di atas Tailwind
├── js/
│   ├── store.js      # LocalStorage + data sampel (barang, transaksi, akun, beban)
│   ├── auth.js       # Login, hashing password, sesi, hak akses role
│   ├── kasir.js      # Penjualan: keranjang, bayar, struk, batal
│   ├── pembelian.js  # Pembelian/restok: tambah stok, barang baru
│   ├── stok.js       # Master barang: tambah/edit/hapus + peringatan stok menipis
│   ├── laporan.js    # Laba Rugi, Neraca, Arus Kas + tambah beban
│   ├── pengaturan.js # Pengaturan Akun admin: kelola pengguna & password
│   └── app.js        # Auth gate, navigasi berbasis role, statistik, jam
```

## Cara menjalankan

**Opsi 1 — klik ganda (termudah):**
1. Buka folder ini di File Explorer.
2. Klik ganda `index.html` → terbuka di browser (Chrome/Edge disarankan).

**Opsi 2 — via VS Code:**
1. Install extension **Live Server**.
2. Klik kanan `index.html` → **Open with Live Server**.

**Opsi 3 — via terminal (Python):**
```powershell
cd "C:\Users\Alif Senja\Documents\Kasir-Laporan-Keuangan"
python -m http.server 8080
# buka http://localhost:8080
```

> Internet dibutuhkan saat pertama load untuk CDN Tailwind & font. Setelah itu UI tetap jalan; data tersimpan offline di LocalStorage.

## Data awal (LocalStorage)

Saat pertama dibuka, `store.js` mengisi otomatis:

| Key | Isi |
|---|---|
| `pos_products` | 10 barang sampel (Indomie, Aqua, Beras, Minyak, dll) |
| `pos_transactions` | 6 penjualan + 2 pembelian sampel |
| `pos_accounts` | Bagan akun: Kas, Persediaan, Utang, Modal, Pendapatan, HPP, Beban |
| `pos_expenses` | 3 beban: sewa, gaji, listrik |
| `pos_initialized_v1` | Flag seeding |

Struktur JSON barang:
```json
{ "id": "BRG-001", "sku": "SKU-001", "nama": "Indomie Goreng", "kategori": "Makanan", "hargaBeli": 2800, "hargaJual": 3500, "stok": 120, "satuan": "pcs", "minStok": 20 }
```

Struktur transaksi:
```json
{ "id": "JUAL-...", "tanggal": "ISO", "tipe": "penjualan|pembelian", "items": [{ "productId": "...", "nama": "...", "qty": 2, "harga": 3500, "subtotal": 7000 }], "total": 7000, "metode": "Tunai|QRIS|Transfer" }
```

## Login & hak akses

Aplikasi terkunci di layar login. Sesi disimpan di `sessionStorage` (hangus saat tab ditutup).

| Akun demo | Username | Password | Akses |
|---|---|---|---|
| Admin | `admin` | `admin123` | Pembelian, Stok, Keuangan, Laporan, **Pengaturan Akun** (tanpa Kasir) |
| Kasir | `kasir` | `kasir123` | **Kasir saja** |

- Password disimpan sebagai **hash** (SHA-256 + salt; fallback murni-JS bila `crypto.subtle` tak tersedia) di key `pos_users` — bukan plaintext.
- Menu navigasi (desktop + mobile) dirender dinamis sesuai role; akses langsung via `showPage()` juga dijaga dan ditolak dengan toast.
- Nama kasir yang login tercatat otomatis di setiap transaksi penjualan.
- Menu **⚙️ Pengaturan Akun** (khusus admin): ganti password sendiri, tambah/edit/nonaktifkan/hapus pengguna, reset password ke `123456`. Proteksi: tak bisa hapus/nonaktifkan akun sendiri atau satu-satunya admin aktif.
- Setelah login pertama, **segera ganti password demo** via Pengaturan Akun.
- ⚠️ Batasan: ini keamanan level demo (data di LocalStorage). Untuk produksi, pindahkan autentikasi + data ke backend.

## Fitur tahap 1

- **Kasir**: cari barang, keranjang +/−, Tunai/QRIS/Transfer, kembalian otomatis, struk, stok berkurang otomatis, batal transaksi (stok kembali).
- **Pembelian**: pilih barang + qty + harga beli, simpan → stok bertambah; bisa tambah barang baru.
- **Stok**: tabel + cari, badge Aman/Menipis/Habis, tambah/edit/hapus via modal.
- **Laporan**: filter tanggal, tab Laba Rugi (pendapatan−HPP−beban), Neraca (aktiva=pasiva check), Arus Kas (masuk/keluar/bersih), tambah beban, tombol cetak.
- Tombol **Reset data demo** di sidebar untuk kembali ke sampel awal.

## Reset manual

DevTools (F12) → Console:
```js
localStorage.clear(); location.reload();
```

## Rencana tahap 2 (belum dibuat)

- Diskon & pajak, cetak struk thermal, export Excel/PDF, supabase/firebase sync.
