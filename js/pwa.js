/**
 * pwa.js
 * ---------------------------------------------------------------
 * 1. Mendaftarkan service worker (sw.js) supaya app bisa dipakai
 *    offline dan di-"install" ke home screen.
 * 2. Menampilkan tombol "Pasang Aplikasi" saat browser (Chrome/Edge
 *    di Android, desktop Chrome, dll) menawarkan install prompt
 *    lewat event `beforeinstallprompt`.
 *
 * Catatan: Safari/iOS tidak mendukung `beforeinstallprompt` — di
 * iOS user tetap bisa "Add to Home Screen" manual lewat menu Share,
 * dan meta tag apple-mobile-web-app-* di index.html sudah menangani
 * tampilannya saat dibuka dari home screen.
 * ---------------------------------------------------------------
 */

(function () {
  "use strict";

  // Path registrasi pakai "./sw.js" (relatif) supaya tetap benar
  // saat di-hosting di subpath GitHub Pages (username.github.io/repo/).
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.warn("Gagal mendaftarkan service worker:", err);
      });
    });
  }

  // ---------------------------------------------------------------
  // Install prompt (Android/Chrome/Edge)
  // ---------------------------------------------------------------

  let deferredPrompt = null;
  const installBtn = document.getElementById("install-app-btn");

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (installBtn) installBtn.hidden = false;
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      installBtn.hidden = true;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    });
  }

  window.addEventListener("appinstalled", () => {
    if (installBtn) installBtn.hidden = true;
    deferredPrompt = null;
  });
})();
