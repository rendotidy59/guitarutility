/**
 * sw.js — Service Worker untuk Guitar Utility
 * ---------------------------------------------------------------
 * Strategi: precache "app shell" saat install, lalu untuk setiap
 * request pakai "cache-first, fallback ke network" supaya app bisa
 * dibuka ulang tanpa koneksi internet (misalnya saat latihan di
 * tempat tanpa sinyal). Kalau request gagal total (offline + belum
 * ada di cache) dan itu adalah navigasi halaman, kembalikan
 * index.html dari cache sebagai fallback.
 *
 * PENTING: semua path di bawah ini RELATIF (tanpa "/" di depan)
 * supaya tetap benar saat di-hosting di GitHub Pages lewat subpath
 * (contoh: https://username.github.io/guitarutility/).
 *
 * Saat deploy ulang dengan perubahan file, naikkan CACHE_VERSION
 * supaya browser mengambil ulang semua asset (bukan pakai cache lama).
 * ---------------------------------------------------------------
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `guitar-utility-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/tuner.js",
  "./js/metronome.js",
  "./icons/icon-16.png",
  "./icons/icon-32.png",
  "./icons/icon-48.png",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-192.png",
  "./icons/icon-384.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("guitar-utility-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Hanya tangani GET; biarkan request lain (POST dll) lewat apa adanya.
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Simpan salinan response valid ke cache untuk dipakai offline nanti.
          if (response && response.status === 200 && response.type === "basic") {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Offline total & belum ada di cache: kalau ini navigasi halaman,
          // tampilkan shell utama (index.html) sebagai fallback.
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return undefined;
        });
    })
  );
});
