# Guitar Utility

Web sederhana untuk latihan gitar: **Tuner** (via mikrofon) dan **Metronome**. Dibuat dengan HTML, CSS, dan JavaScript murni (tanpa framework/library eksternal), tema *light & classic*, dan sudah jadi **PWA (Progressive Web App)** — bisa di-install ke home screen HP dan tetap jalan offline.

## Cara menjalankan

Browser modern mewajibkan akses mikrofon (`getUserMedia`) hanya dari *secure context* (`https://` atau `localhost`). Membuka `index.html` langsung lewat `file://` bisa gagal meminta izin mikrofon di beberapa browser, jadi jalankan lewat server lokal:

**Opsi 1 — VS Code Live Server**
Klik kanan `index.html` → "Open with Live Server".

**Opsi 2 — Node (tanpa install apa pun)**
```bash
npx serve .
```
lalu buka `http://localhost:3000` (atau port yang ditampilkan).

**Opsi 3 — Python**
```bash
python -m http.server 8000
```
lalu buka `http://localhost:8000`.

Menu **Metronome** tidak butuh mikrofon, jadi bisa langsung dibuka walau lewat `file://`.

Service worker (`sw.js`) hanya aktif lewat `http://localhost`/`https://`, bukan `file://` — jadi untuk coba fitur offline/install, tetap pakai salah satu opsi server lokal di atas.

## Deploy ke GitHub Pages

1. Push folder ini ke repo GitHub (nama file & struktur sudah pakai path **relatif**, jadi aman di-hosting di subpath seperti `https://username.github.io/nama-repo/`).
2. Di repo → **Settings → Pages** → pilih branch (`main`) dan folder `/ (root)` → Save.
3. Tunggu beberapa menit, lalu akses `https://username.github.io/nama-repo/`. GitHub Pages otomatis pakai HTTPS, jadi mikrofon untuk Tuner dan install PWA bisa langsung berfungsi.
4. **Setiap kali update file CSS/JS/HTML dan push ulang**, naikkan `CACHE_VERSION` di [js/sw.js](sw.js) (misal dari `"v1"` ke `"v2"`) — ini penting supaya HP yang sudah pernah buka/install app langsung ambil versi baru, bukan terus pakai cache lama.

## PWA: install ke HP

- **Android (Chrome/Edge)**: akan muncul tombol "Pasang Aplikasi" di header otomatis (lewat event `beforeinstallprompt`), atau manual lewat menu browser → "Add to Home screen" / "Install app".
- **iOS (Safari)**: Safari belum mendukung prompt otomatis, jadi install manual: tombol **Share** → **Add to Home Screen**. Ikon & nama app sudah disiapkan lewat meta tag `apple-mobile-web-app-*` dan `apple-touch-icon.png`.
- Setelah di-install, app dibuka fullscreen tanpa address bar (`"display": "standalone"` di [manifest.json](manifest.json)), dan tetap bisa dipakai offline karena asset inti (HTML/CSS/JS/ikon) sudah di-precache oleh service worker.

## Struktur proyek

```
guitarutility/
├── index.html            # Struktur halaman + nav menu + meta tag PWA
├── manifest.json          # Web App Manifest (nama, ikon, warna tema, dll)
├── sw.js                   # Service worker: precache + mode offline
├── favicon.ico             # Favicon multi-resolusi (16/32/48)
├── apple-touch-icon.png    # Ikon khusus "Add to Home Screen" iOS
├── icons/                  # Ikon PWA berbagai ukuran (16px–512px)
├── css/
│   └── style.css            # Tema light & classic (warna kayu/parchment)
└── js/
    ├── app.js                # Navigasi antar menu + sub-menu (panel switcher)
    ├── tuner.js               # Deteksi pitch via mikrofon + contoh suara tuning
    ├── metronome.js           # Metronome dengan lookahead scheduling
    └── pwa.js                 # Registrasi service worker + tombol install
```

## Menambah menu baru di kemudian hari

1. Tambahkan tombol nav di `index.html`:
   ```html
   <li><button class="nav-btn" data-target="namamenu">Nama Menu</button></li>
   ```
2. Tambahkan panel section:
   ```html
   <section id="namamenu" class="panel" aria-labelledby="namamenu-heading">
     ...
   </section>
   ```
3. Buat `js/namamenu.js` sendiri, lalu daftarkan ke `index.html`.
4. Gunakan `GuitarUtility.onPanelChange("namamenu", (isActive) => {...})`
   dari `app.js` untuk tahu kapan panel aktif/nonaktif (misalnya untuk
   otomatis start/stop audio saat pindah menu).

`app.js` sudah menangani logika switch panel + nav secara generik, jadi
menu baru otomatis ikut pola yang sama tanpa perlu ubah `app.js`.

## Fitur saat ini

- **Tuner**: deteksi nada dari mikrofon (algoritma autocorrelation),
  indikator jarum ± cents, plus sub-menu "Contoh Suara" berisi referensi
  nada tiap senar untuk 8 tuning (Standard, Drop D, Half Step Down, Open D,
  Open G, Open C, Drop C, DADGAD) yang bisa dibunyikan lewat oscillator.
- **Metronome**: BPM 30–240, pilihan birama (2/4, 3/4, 4/4, 6/8),
  tap tempo, indikator visual ketukan dengan aksen di ketukan pertama.
- **PWA**: bisa di-install ke home screen, jalan offline, ikon & nama
  app custom, splash/theme color menyesuaikan tema light & classic.
