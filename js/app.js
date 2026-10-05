/**
 * app.js
 * ---------------------------------------------------------------
 * Mengatur navigasi antar menu (panel) di Guitar Utility.
 *
 * Didesain agar mudah dikembangkan: setiap menu baru cukup
 * ditambahkan sebagai:
 *   1. <button class="nav-btn" data-target="namamenu">...</button>
 *   2. <section id="namamenu" class="panel">...</section>
 * lalu didaftarkan (opsional) lewat GuitarUtility.registerTool().
 *
 * Tool lain (tuner.js, metronome.js) bisa memanggil
 * GuitarUtility.onPanelChange(id, callback) untuk tahu kapan
 * panel mereka ditampilkan/disembunyikan, misalnya untuk otomatis
 * menghentikan mikrofon atau metronome saat pindah menu.
 * ---------------------------------------------------------------
 */

(function () {
  "use strict";

  const navButtons = Array.from(document.querySelectorAll(".nav-btn[data-target]"));
  const panels = Array.from(document.querySelectorAll(".panel"));

  /** @type {Record<string, Array<(active: boolean) => void>>} */
  const panelListeners = {};

  function activatePanel(targetId) {
    panels.forEach((panel) => {
      const isTarget = panel.id === targetId;
      const wasActive = panel.classList.contains("is-active");
      panel.classList.toggle("is-active", isTarget);

      if (wasActive !== isTarget) {
        notifyListeners(panel.id, isTarget);
      }
    });

    navButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.target === targetId);
    });
  }

  function notifyListeners(panelId, isActive) {
    const callbacks = panelListeners[panelId];
    if (!callbacks) return;
    callbacks.forEach((cb) => {
      try {
        cb(isActive);
      } catch (err) {
        console.error(`Error pada listener panel "${panelId}":`, err);
      }
    });
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      activatePanel(btn.dataset.target);
    });
  });

  /**
   * Sub-nav generik: setiap panel bisa punya tab internal sendiri
   * (misalnya Tuner punya "Tuner Mikrofon" vs "Contoh Suara").
   * Cukup tambahkan markup:
   *   <div class="sub-nav">
   *     <button class="sub-nav-btn is-active" data-subtarget="id-a">A</button>
   *     <button class="sub-nav-btn" data-subtarget="id-b">B</button>
   *   </div>
   *   <div id="id-a" class="sub-panel is-active">...</div>
   *   <div id="id-b" class="sub-panel">...</div>
   * tanpa perlu menulis JS switching baru.
   */
  document.querySelectorAll(".sub-nav").forEach((subNav) => {
    const subButtons = Array.from(subNav.querySelectorAll(".sub-nav-btn"));
    const container = subNav.parentElement;

    subButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.subtarget;

        subButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
        container.querySelectorAll(".sub-panel").forEach((sp) => {
          sp.classList.toggle("is-active", sp.id === targetId);
        });
      });
    });
  });

  /**
   * API publik untuk modul tool lain (tuner, metronome, dan menu
   * mendatang) agar bisa bereaksi saat panelnya aktif/nonaktif.
   */
  window.GuitarUtility = window.GuitarUtility || {};

  window.GuitarUtility.onPanelChange = function onPanelChange(panelId, callback) {
    if (!panelListeners[panelId]) {
      panelListeners[panelId] = [];
    }
    panelListeners[panelId].push(callback);
  };

  /**
   * Placeholder pendaftaran tool untuk pengembangan menu baru
   * di masa depan (misal: chord library, metronome preset, dll).
   * Saat ini hanya menyimpan metadata — belum ada UI generator,
   * tapi struktur ini membuat penambahan menu baru lebih rapi.
   */
  const registeredTools = [];
  window.GuitarUtility.registerTool = function registerTool(meta) {
    registeredTools.push(meta);
  };
  window.GuitarUtility.getTools = function getTools() {
    return registeredTools.slice();
  };

  window.GuitarUtility.registerTool({ id: "tuner", name: "Tuner" });
  window.GuitarUtility.registerTool({ id: "metronome", name: "Metronome" });
})();
