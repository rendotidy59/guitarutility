/**
 * tuner.js
 * ---------------------------------------------------------------
 * Guitar tuner sederhana berbasis Web Audio API.
 *
 * Alur kerja:
 *  1. Minta akses mikrofon via getUserMedia.
 *  2. Ambil data audio mentah lewat AnalyserNode.
 *  3. Deteksi pitch (frekuensi dasar) dengan algoritma
 *     autocorrelation pada domain waktu (cukup akurat untuk
 *     nada senar gitar, dan tidak butuh library eksternal).
 *  4. Cocokkan frekuensi hasil deteksi ke nada terdekat,
 *     tampilkan nama nada + selisih dalam "cents".
 *
 * Juga menyediakan tombol referensi nada (E A D G B E) yang
 * memutar tone oscillator agar user bisa membandingkan dengan
 * telinga sebelum/selain pakai mikrofon.
 * ---------------------------------------------------------------
 */

(function () {
  "use strict";

  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const A4_FREQ = 440;
  const A4_MIDI = 69;

  const toggleBtn = document.getElementById("tuner-toggle");
  const statusEl = document.getElementById("tuner-status");
  const noteNameEl = document.getElementById("note-name");
  const freqValueEl = document.getElementById("freq-value");
  const centsValueEl = document.getElementById("cents-value");
  const needleEl = document.getElementById("meter-needle");
  const tuningSelect = document.getElementById("tuning-select");
  const referenceListEl = document.getElementById("reference-string-list");

  // ---------------------------------------------------------------
  // Data tuning: setiap entri dari senar paling tebal (6) ke paling
  // tipis (1). Frekuensi dihitung dengan equal temperament, A4=440Hz.
  // ---------------------------------------------------------------

  const TUNINGS = {
    standard: [
      { string: 6, note: "E2", freq: 82.41 },
      { string: 5, note: "A2", freq: 110.0 },
      { string: 4, note: "D3", freq: 146.83 },
      { string: 3, note: "G3", freq: 196.0 },
      { string: 2, note: "B3", freq: 246.94 },
      { string: 1, note: "E4", freq: 329.63 },
    ],
    dropD: [
      { string: 6, note: "D2", freq: 73.42 },
      { string: 5, note: "A2", freq: 110.0 },
      { string: 4, note: "D3", freq: 146.83 },
      { string: 3, note: "G3", freq: 196.0 },
      { string: 2, note: "B3", freq: 246.94 },
      { string: 1, note: "E4", freq: 329.63 },
    ],
    halfStepDown: [
      { string: 6, note: "Eb2", freq: 77.78 },
      { string: 5, note: "Ab2", freq: 103.83 },
      { string: 4, note: "Db3", freq: 138.59 },
      { string: 3, note: "Gb3", freq: 185.0 },
      { string: 2, note: "Bb3", freq: 233.08 },
      { string: 1, note: "Eb4", freq: 311.13 },
    ],
    openD: [
      { string: 6, note: "D2", freq: 73.42 },
      { string: 5, note: "A2", freq: 110.0 },
      { string: 4, note: "D3", freq: 146.83 },
      { string: 3, note: "F#3", freq: 185.0 },
      { string: 2, note: "A3", freq: 220.0 },
      { string: 1, note: "D4", freq: 293.66 },
    ],
    openG: [
      { string: 6, note: "D2", freq: 73.42 },
      { string: 5, note: "G2", freq: 98.0 },
      { string: 4, note: "D3", freq: 146.83 },
      { string: 3, note: "G3", freq: 196.0 },
      { string: 2, note: "B3", freq: 246.94 },
      { string: 1, note: "D4", freq: 293.66 },
    ],
    openC: [
      { string: 6, note: "C2", freq: 65.41 },
      { string: 5, note: "G2", freq: 98.0 },
      { string: 4, note: "C3", freq: 130.81 },
      { string: 3, note: "G3", freq: 196.0 },
      { string: 2, note: "C4", freq: 261.63 },
      { string: 1, note: "E4", freq: 329.63 },
    ],
    dropC: [
      { string: 6, note: "C2", freq: 65.41 },
      { string: 5, note: "G2", freq: 98.0 },
      { string: 4, note: "C3", freq: 130.81 },
      { string: 3, note: "F3", freq: 174.61 },
      { string: 2, note: "A3", freq: 220.0 },
      { string: 1, note: "D4", freq: 293.66 },
    ],
    dadgad: [
      { string: 6, note: "D2", freq: 73.42 },
      { string: 5, note: "A2", freq: 110.0 },
      { string: 4, note: "D3", freq: 146.83 },
      { string: 3, note: "G3", freq: 196.0 },
      { string: 2, note: "A3", freq: 220.0 },
      { string: 1, note: "D4", freq: 293.66 },
    ],
  };

  let audioCtx = null;
  let analyser = null;
  let micStream = null;
  let sourceNode = null;
  let rafId = null;
  let isListening = false;

  let refOscillator = null;
  let refGain = null;

  // ---------------------------------------------------------------
  // Konversi frekuensi -> nada musik terdekat + selisih cents
  // ---------------------------------------------------------------

  function freqToNote(frequency) {
    const midiFloat = A4_MIDI + 12 * Math.log2(frequency / A4_FREQ);
    const midiRounded = Math.round(midiFloat);
    const cents = Math.round((midiFloat - midiRounded) * 100);

    const noteName = NOTE_NAMES[((midiRounded % 12) + 12) % 12];
    const octave = Math.floor(midiRounded / 12) - 1;
    const targetFreq = A4_FREQ * Math.pow(2, (midiRounded - A4_MIDI) / 12);

    return { noteName, octave, cents, targetFreq };
  }

  // ---------------------------------------------------------------
  // Autocorrelation pitch detection (time-domain)
  // Referensi teknik umum untuk tuner berbasis browser.
  // ---------------------------------------------------------------

  function detectPitch(buffer, sampleRate) {
    const size = buffer.length;

    // Hitung RMS untuk memastikan ada sinyal yang cukup kuat
    // (menghindari deteksi pitch dari noise diam).
    let rms = 0;
    for (let i = 0; i < size; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / size);
    if (rms < 0.01) return -1;

    // Trim bagian awal/akhir yang amplitudonya sangat kecil
    let start = 0;
    let end = size - 1;
    const threshold = 0.2;
    while (start < size / 2 && Math.abs(buffer[start]) < threshold) start++;
    while (end > size / 2 && Math.abs(buffer[end]) < threshold) end--;

    const trimmed = buffer.slice(start, end);
    const n = trimmed.length;
    if (n < 2) return -1;

    const correlations = new Array(n).fill(0);
    for (let lag = 0; lag < n; lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += trimmed[i] * trimmed[i + lag];
      }
      correlations[lag] = sum;
    }

    // Cari lag pertama setelah korelasi turun lalu naik lagi
    // (melewati lag=0 yang selalu maksimum).
    let d = 0;
    while (d < n - 1 && correlations[d] > correlations[d + 1]) d++;

    let maxVal = -1;
    let maxLag = -1;
    for (let lag = d; lag < n; lag++) {
      if (correlations[lag] > maxVal) {
        maxVal = correlations[lag];
        maxLag = lag;
      }
    }

    if (maxLag <= 0) return -1;

    // Interpolasi parabola di sekitar puncak untuk presisi sub-sample
    const x1 = correlations[maxLag - 1] || 0;
    const x2 = correlations[maxLag];
    const x3 = correlations[maxLag + 1] || 0;
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    const refinedLag = a !== 0 ? maxLag - b / (2 * a) : maxLag;

    const frequency = sampleRate / refinedLag;

    // Rentang frekuensi gitar standar (dengan sedikit margin)
    if (frequency < 60 || frequency > 1200) return -1;

    return frequency;
  }

  // ---------------------------------------------------------------
  // Loop analisis mikrofon
  // ---------------------------------------------------------------

  function analyseLoop() {
    if (!isListening) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    const frequency = detectPitch(buffer, audioCtx.sampleRate);

    if (frequency > 0) {
      updateDisplay(frequency);
    } else {
      updateDisplay(null);
    }

    rafId = requestAnimationFrame(analyseLoop);
  }

  function updateDisplay(frequency) {
    if (!frequency) {
      noteNameEl.textContent = "—";
      freqValueEl.textContent = "0.0 Hz";
      centsValueEl.textContent = "0 cents";
      setNeedle(0, "neutral");
      return;
    }

    const { noteName, octave, cents } = freqToNote(frequency);

    noteNameEl.textContent = `${noteName}${octave}`;
    freqValueEl.textContent = `${frequency.toFixed(1)} Hz`;
    centsValueEl.textContent = `${cents > 0 ? "+" : ""}${cents} cents`;

    let state = "neutral";
    if (Math.abs(cents) <= 5) state = "in-tune";
    else if (cents < 0) state = "flat";
    else state = "sharp";

    setNeedle(cents, state);
  }

  function setNeedle(cents, state) {
    // Clamp ke rentang meter (-50..+50 cents) lalu konversi ke posisi %
    const clamped = Math.max(-50, Math.min(50, cents));
    const percent = 50 + clamped; // 0..100
    needleEl.style.left = `${percent}%`;

    needleEl.classList.remove("is-flat", "is-sharp", "is-in-tune");
    if (state === "flat") needleEl.classList.add("is-flat");
    else if (state === "sharp") needleEl.classList.add("is-sharp");
    else if (state === "in-tune") needleEl.classList.add("is-in-tune");
  }

  // ---------------------------------------------------------------
  // Start / stop mikrofon
  // ---------------------------------------------------------------

  async function startTuner() {
    try {
      statusEl.textContent = "Meminta akses mikrofon...";

      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      sourceNode = audioCtx.createMediaStreamSource(micStream);

      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      sourceNode.connect(analyser);

      isListening = true;
      toggleBtn.textContent = "Hentikan Tuner";
      toggleBtn.classList.add("is-active");
      statusEl.textContent = "Mendengarkan... mainkan satu senar.";

      analyseLoop();
    } catch (err) {
      console.error("Gagal mengakses mikrofon:", err);
      statusEl.textContent =
        "Tidak bisa mengakses mikrofon. Pastikan izin mikrofon diberikan pada browser.";
    }
  }

  function stopTuner() {
    isListening = false;

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      micStream = null;
    }

    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }

    sourceNode = null;
    analyser = null;

    toggleBtn.textContent = "Mulai Tuner";
    toggleBtn.classList.remove("is-active");
    statusEl.textContent = "Mikrofon belum aktif";
    updateDisplay(null);
  }

  toggleBtn.addEventListener("click", () => {
    if (isListening) {
      stopTuner();
    } else {
      startTuner();
    }
  });

  // ---------------------------------------------------------------
  // Tombol referensi nada (oscillator tone)
  // ---------------------------------------------------------------

  function ensureRefAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function playReferenceTone(frequency, chipEl) {
    const ctx = ensureRefAudioCtx();

    stopReferenceTone();

    refOscillator = ctx.createOscillator();
    refGain = ctx.createGain();

    refOscillator.type = "sine";
    refOscillator.frequency.value = frequency;

    refGain.gain.value = 0;
    refGain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05);

    refOscillator.connect(refGain);
    refGain.connect(ctx.destination);
    refOscillator.start();

    getStringChips().forEach((chip) => chip.classList.remove("is-playing"));
    chipEl.classList.add("is-playing");

    // Otomatis berhenti setelah 2 detik agar tidak berdenging terus
    refOscillator._stopTimeout = setTimeout(() => stopReferenceTone(), 2000);
  }

  function stopReferenceTone() {
    if (refOscillator) {
      try {
        refGain.gain.linearRampToValueAtTime(0, (audioCtx?.currentTime || 0) + 0.05);
        refOscillator.stop((audioCtx?.currentTime || 0) + 0.06);
      } catch (e) {
        /* oscillator mungkin sudah berhenti, aman diabaikan */
      }
      clearTimeout(refOscillator._stopTimeout);
      refOscillator = null;
      refGain = null;
    }
    document.querySelectorAll(".string-chip.is-playing").forEach((chip) =>
      chip.classList.remove("is-playing")
    );
  }

  function getStringChips() {
    return Array.from(document.querySelectorAll(".string-chip"));
  }

  // Event delegation: chip referensi standard tuning di tab mikrofon
  // (kalau ada) maupun chip yang dirender dinamis di tab "Contoh Suara"
  // sama-sama ditangani lewat satu listener ini.
  document.body.addEventListener("click", (event) => {
    const chip = event.target.closest(".string-chip");
    if (!chip) return;

    const freq = parseFloat(chip.dataset.freq);
    if (chip.classList.contains("is-playing")) {
      stopReferenceTone();
    } else {
      playReferenceTone(freq, chip);
    }
  });

  // ---------------------------------------------------------------
  // Sub menu "Contoh Suara": render chip senar sesuai tuning terpilih
  // ---------------------------------------------------------------

  function renderReferenceStrings(tuningKey) {
    if (!referenceListEl) return;

    stopReferenceTone();
    referenceListEl.innerHTML = "";

    const strings = TUNINGS[tuningKey] || TUNINGS.standard;

    strings.forEach((item) => {
      const chip = document.createElement("button");
      chip.className = "string-chip";
      chip.dataset.freq = item.freq;
      chip.dataset.note = item.note;
      chip.innerHTML = `<span class="string-num">${item.string}</span>${item.note}`;
      referenceListEl.appendChild(chip);
    });
  }

  if (tuningSelect) {
    tuningSelect.addEventListener("change", () => {
      renderReferenceStrings(tuningSelect.value);
    });
    renderReferenceStrings(tuningSelect.value);
  }

  // ---------------------------------------------------------------
  // Hentikan mikrofon otomatis saat user pindah ke menu lain,
  // supaya tidak ada mikrofon yang "bocor" aktif di background.
  // ---------------------------------------------------------------

  if (window.GuitarUtility && window.GuitarUtility.onPanelChange) {
    window.GuitarUtility.onPanelChange("tuner", (isActive) => {
      if (!isActive) {
        if (isListening) stopTuner();
        stopReferenceTone();
      }
    });
  }
})();
