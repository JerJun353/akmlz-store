# Akmlz Store — backend + panel admin

Toko item game dengan backend Node.js (Express). Ada 2 bagian:

- **Halaman toko** (`/`) — bisa dilihat siapa saja, datanya diambil dari server.
- **Panel admin** (`/admin`) — dikunci password, buat kelola produk, stock fruit, dan pengaturan toko.

Data disimpan di file `data/products.json`, dan foto produk disimpan di folder `uploads/`. Jadi kalau admin upload foto baru dari HP/laptop admin, foto itu kesimpan di **server**, bukan cuma di device admin — makanya semua pengunjung bisa lihat foto yang sama.

## 1. Jalanin di komputer sendiri (buat testing)

Butuh [Node.js](https://nodejs.org) versi 18 atau lebih baru.

```bash
npm install
cp .env.example .env
```

Buka file `.env`, ganti:
- `ADMIN_PASSWORD` — password buat masuk `/admin`
- `SESSION_SECRET` — string acak (boleh generate pakai `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

Lalu jalankan:

```bash
npm start
```

Buka `http://localhost:3000` untuk lihat toko, dan `http://localhost:3000/admin` untuk panel admin.

## 2. Deploy ke hosting

**Penting:** ini backend Node.js beneran, jadi butuh hosting yang **support Node.js** — bukan hosting statis biasa (HTML/PHP-only). Beberapa opsi yang cocok:

- [Railway](https://railway.app) — paling gampang, tinggal upload folder ini atau connect ke GitHub.
- [Render](https://render.com) — punya free tier untuk web service Node.
- VPS (misal DigitalOcean, Contabo) kalau mau kontrol penuh.
- Hosting cPanel yang punya fitur "Setup Node.js App" (banyak hosting lokal Indonesia sudah punya ini).

Langkah umum di semua hosting Node:
1. Upload/extract seluruh folder ini ke server.
2. Set environment variable `ADMIN_PASSWORD` dan `SESSION_SECRET` lewat panel hosting (jangan upload file `.env` asli ke tempat publik).
3. Jalankan `npm install` lalu `npm start` (biasanya otomatis kalau pakai platform seperti Railway/Render).
4. Hosting akan kasih kamu URL publik, contoh `https://akmlz-store.up.railway.app`.

## 3. Keamanan panel admin

- Ganti `ADMIN_PASSWORD` di `.env` — jangan pakai default `akmlz123`.
- Jangan share URL `/admin` ke sembarang orang meskipun dikunci password.
- Selalu akses lewat HTTPS (semua hosting yang disebut di atas otomatis kasih HTTPS gratis).
- Login admin pakai session cookie yang otomatis expired setelah 8 jam.

## 4. Struktur folder

```
server.js            → backend Express (API + auth + upload)
data/products.json    → semua data toko (produk, stock, pengaturan) — ini "database"-nya
uploads/              → foto-foto produk & logo yang diupload
public/
  index.html          → halaman toko
  app.js              → logic frontend toko (fetch data dari API)
  styles.css          → styling toko
  admin/
    index.html        → halaman panel admin
    admin.js           → logic panel admin (login, CRUD produk, dst)
    admin.css          → styling khusus admin
```

## 5. Kalau nanti mau ganti ke database asli

Sekarang datanya disimpan di file JSON biasa — cukup buat toko kecil-menengah. Kalau nanti sudah ramai dan butuh database asli (PostgreSQL/MySQL/MongoDB), tinggal ganti isi fungsi `readData()` dan `writeData()` di `server.js`, sisanya (routing, upload, auth) gak perlu diubah.
