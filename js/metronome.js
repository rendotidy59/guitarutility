/**
 * metronome.js
 * ---------------------------------------------------------------
 * Metronome berbasis Web Audio API dengan "lookahead scheduling"
 * agar tempo tetap akurat walau browser/JS timer tidak presisi
 * (setInterval biasa bisa drift beberapa puluh ms).
 *
 * Teknik: setInterval berjalan sering (tiap 25ms) hanya untuk
 * MENJADWALKAN bunyi klik beberapa saat ke depan menggunakan
 * AudioContext.currentTime sebagai jam referensi yang presisi,
 * bukan untuk langsung memicu bunyi.
 * ---------------------------------------------------------------
 */

(function () {
  "use strict";

  const toggleBtn = document.getElementById("metronome-toggle");
  const bpmValueEl = document.getElementById("bpm-value");
  const bpmSlider = document.getElementById("bpm-slider");
  const bpmDownBtn = document.getElementById("bpm-down");
  const bpmUpBtn = document.getElementById("bpm-up");
  const timeSignatureSelect = document.getElementById("time-signature");
  const tapTempoBtn = document.getElementById("tap-tempo");
  const visualEl = document.getElementById("metronome-visual");

  const SCHEDULE_AHEAD_TIME = 0.1; // detik, seberapa jauh ke depan kita jadwalkan bunyi
  const LOOKAHEAD_INTERVAL = 25; // ms, seberapa sering scheduler dijalankan

  let audioCtx = null;
  let bpm = parseInt(bpmSlider.value, 10);
  let beatsPerBar = parseInt(timeSignatureSelect.value, 10);

  let isRunning = false;
  let currentBeat = 0;
  let nextNoteTime = 0;
  let schedulerTimer = null;

  let beatDots = [];

  // ---------------------------------------------------------------
  // Visual: titik-titik ketukan sesuai birama
  // ---------------------------------------------------------------

  function buildBeatDots() {
    visualEl.innerHTML = "";
    beatDots = [];

    for (let i = 0; i < beatsPerBar; i++) {
      const dot = document.createElement("div");
      dot.className = "beat-dot";
      if (i === 0) dot.classList.add("is-accent");
      visualEl.appendChild(dot);
      beatDots.push(dot);
    }
  }

  function flashBeat(beatIndex) {
    beatDots.forEach((dot, i) => {
      dot.classList.toggle("is-on", i === beatIndex);
    });
  }

  buildBeatDots();

  // ---------------------------------------------------------------
  // Audio: bunyi klik (oscillator pendek), aksen di ketukan pertama
  // ---------------------------------------------------------------

  function scheduleClick(beatIndex, time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    const isAccent = beatIndex === 0;
    osc.frequency.value = isAccent ? 1000 : 700;

    gain.gain.setValueAtTime(isAccent ? 0.6 : 0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.06);

    // Sinkronkan animasi visual dengan waktu bunyi yang terjadwal
    const delayMs = Math.max(0, (time - audioCtx.currentTime) * 1000);
    setTimeout(() => flashBeat(beatIndex), delayMs);
  }

  function nextNote() {
    const secondsPerBeat = 60.0 / bpm;
    nextNoteTime += secondsPerBeat;
    currentBeat = (currentBeat + 1) % beatsPerBar;
  }

  function scheduler() {
    while (nextNoteTime < audioCtx.currentTime + SCHEDULE_AHEAD_TIME) {
      scheduleClick(currentBeat, nextNoteTime);
      nextNote();
    }
    schedulerTimer = setTimeout(scheduler, LOOKAHEAD_INTERVAL);
  }

  // ---------------------------------------------------------------
  // Start / stop
  // ---------------------------------------------------------------

  function startMetronome() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    currentBeat = 0;
    nextNoteTime = audioCtx.currentTime + 0.05;
    isRunning = true;

    toggleBtn.textContent = "Stop";
    toggleBtn.classList.add("is-active");

    scheduler();
  }

  function stopMetronome() {
    isRunning = false;

    if (schedulerTimer) {
      clearTimeout(schedulerTimer);
      schedulerTimer = null;
    }

    toggleBtn.textContent = "Start";
    toggleBtn.classList.remove("is-active");

    beatDots.forEach((dot) => dot.classList.remove("is-on"));
  }

  toggleBtn.addEventListener("click", () => {
    if (isRunning) {
      stopMetronome();
    } else {
      startMetronome();
    }
  });

  // ---------------------------------------------------------------
  // Kontrol BPM
  // ---------------------------------------------------------------

  function setBpm(newBpm) {
    bpm = Math.max(30, Math.min(240, Math.round(newBpm)));
    bpmValueEl.textContent = bpm;
    bpmSlider.value = bpm;
  }

  bpmSlider.addEventListener("input", () => setBpm(parseInt(bpmSlider.value, 10)));
  bpmDownBtn.addEventListener("click", () => setBpm(bpm - 1));
  bpmUpBtn.addEventListener("click", () => setBpm(bpm + 1));

  timeSignatureSelect.addEventListener("change", () => {
    beatsPerBar = parseInt(timeSignatureSelect.value, 10);
    currentBeat = 0;
    buildBeatDots();
  });

  // ---------------------------------------------------------------
  // Tap Tempo: hitung BPM dari interval klik user
  // ---------------------------------------------------------------

  let tapTimes = [];
  const TAP_RESET_MS = 2000; // kalau diam > 2 detik, mulai hitung ulang

  tapTempoBtn.addEventListener("click", () => {
    const now = performance.now();

    if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > TAP_RESET_MS) {
      tapTimes = [];
    }

    tapTimes.push(now);
    if (tapTimes.length > 6) tapTimes.shift(); // simpan 6 tap terakhir saja

    if (tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < tapTimes.length; i++) {
        intervals.push(tapTimes[i] - tapTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const tappedBpm = 60000 / avgInterval;
      setBpm(tappedBpm);
    }
  });

  // ---------------------------------------------------------------
  // Hentikan metronome otomatis saat pindah menu
  // ---------------------------------------------------------------

  if (window.GuitarUtility && window.GuitarUtility.onPanelChange) {
    window.GuitarUtility.onPanelChange("metronome", (isActive) => {
      if (!isActive && isRunning) {
        stopMetronome();
      }
    });
  }
})();
