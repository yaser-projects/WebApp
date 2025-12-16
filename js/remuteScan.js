import { connectWebSocket } from "./ws.js";

/**
 * Remote Scan UI (NO JSON MESSAGES HERE)
 * All Remote Scan messages are created/sent/parsed in ws.js
 * This file ONLY updates UI.
 */

const ADD_DEVICE_PAGE = "addDevice.html";

const MIN_MHZ = 300;
const MAX_MHZ = 928;
const MAX_HITS = 5;

const STEP_OPTIONS = [0.25, 0.5, 1.0];        // MHz
const DWELL_OPTIONS = [10, 20, 30, 50, 100];  // ms

const el = {
  backBtn: document.getElementById("btnBack"),

  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),

  minSlider: document.getElementById("minSlider"),
  maxSlider: document.getElementById("maxSlider"),
  sliderFill: document.getElementById("sliderFill"),

  rangeBox: document.getElementById("rangeBox"),
  stepSelect: document.getElementById("stepSelect"),
  dwellSelect: document.getElementById("dwellSelect"),
  errorBox: document.getElementById("errorBox"),

  ring: document.getElementById("ring"),
  ringFg: document.getElementById("ringFg"),
  pct: document.getElementById("pct"),
  lastFreq: document.getElementById("lastFreq"),
  segmentText: document.getElementById("segmentText"),

  hitsList: document.getElementById("hitsList"),
  searchBtn: document.getElementById("searchBtn"),
};

let ws = null;
let scanning = false;
let hits = [];

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function round2(n) { return Math.round(n * 100) / 100; }
function fmtMHz(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const x = round2(Number(n));
  return (x % 1 === 0) ? x.toFixed(0) : x.toFixed(2);
}

/** ✅ FIX: use variables from common-style.css: --status-good/warn/bad */
function setStatus(kind, text) {
  el.statusDot.style.background =
    kind === "scan" ? "var(--status-warn)" :
    kind === "bad"  ? "var(--status-bad)"  :
    "var(--status-good)";
  el.statusText.textContent = text;
}

function flashRing() {
  el.ring.classList.remove("flash");
  void el.ring.offsetWidth;
  el.ring.classList.add("flash");
  setTimeout(() => el.ring.classList.remove("flash"), 650);
}

function setProgress(p) {
  const prog = clamp(Math.round(p), 0, 100);
  el.pct.textContent = String(prog);
  const circumference = 314;
  const offset = circumference - (prog / 100) * circumference;
  el.ringFg.style.strokeDasharray = String(circumference);
  el.ringFg.style.strokeDashoffset = String(offset);
}

function setLastFreq(mhz) {
  el.lastFreq.textContent = fmtMHz(mhz);
}

function setSegment(segNum = 1, segTotal = 1) {
  el.segmentText.textContent = segTotal > 1 ? `Segment ${segNum} / ${segTotal}` : `Segment ${segNum}`;
}

function validateRange(start, end) {
  return start < end && start >= MIN_MHZ && end <= MAX_MHZ;
}

function lockControls(lock) {
  el.minSlider.disabled = lock;
  el.maxSlider.disabled = lock;
  el.stepSelect.disabled = lock;
  el.dwellSelect.disabled = lock;
  el.searchBtn.disabled = lock || el.errorBox.classList.contains("show");
}

/* ---------- STEP SNAP (FIX) ---------- */
function getStepMHz() {
  const v = Number(el.stepSelect.value);
  return Number.isFinite(v) && v > 0 ? v : 0.25;
}

function snapToStep(value, stepMHz) {
  // Snap relative to MIN_MHZ (important)
  const snapped = MIN_MHZ + Math.round((value - MIN_MHZ) / stepMHz) * stepMHz;
  return round2(clamp(snapped, MIN_MHZ, MAX_MHZ));
}

function applyStepToSliders(stepMHz) {
  // make the native slider move in the right step as well
  el.minSlider.step = String(stepMHz);
  el.maxSlider.step = String(stepMHz);

  // snap current values to step
  let a = snapToStep(Number(el.minSlider.value), stepMHz);
  let b = snapToStep(Number(el.maxSlider.value), stepMHz);

  // enforce ordering
  if (a >= b) {
    // try pushing b forward; if not possible, pull a back
    const b2 = snapToStep(a + stepMHz, stepMHz);
    if (b2 <= MAX_MHZ && b2 > a) b = b2;
    else a = snapToStep(b - stepMHz, stepMHz);
  }

  el.minSlider.value = String(a);
  el.maxSlider.value = String(b);
}

function updateFillAndText() {
  const stepMHz = getStepMHz();

  // always keep snapped while interacting
  let a = snapToStep(Number(el.minSlider.value), stepMHz);
  let b = snapToStep(Number(el.maxSlider.value), stepMHz);

  if (a >= b) {
    // keep at least one step gap
    const b2 = snapToStep(a + stepMHz, stepMHz);
    if (b2 <= MAX_MHZ && b2 > a) b = b2;
    else a = snapToStep(b - stepMHz, stepMHz);
  }

  el.minSlider.value = String(a);
  el.maxSlider.value = String(b);

  const leftPct = ((a - MIN_MHZ) / (MAX_MHZ - MIN_MHZ)) * 100;
  const rightPct = 100 - ((b - MIN_MHZ) / (MAX_MHZ - MIN_MHZ)) * 100;

  el.sliderFill.style.left = `calc(${leftPct}% + 8px)`;
  el.sliderFill.style.right = `calc(${rightPct}% + 8px)`;

  el.rangeBox.value = `${fmtMHz(a)} MHz — ${fmtMHz(b)} MHz`;

  const ok = validateRange(a, b);
  el.errorBox.classList.toggle("show", !ok);

  lockControls(scanning);
}

function ensureOption(selectEl, value, label) {
  const v = String(value);
  const exists = [...selectEl.options].some(o => o.value === v);
  if (!exists) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = label;
    selectEl.appendChild(opt);
  }
  selectEl.value = v;
}

function renderHits() {
  el.hitsList.innerHTML = "";
  if (!hits.length) {
    // ✅ FIX: use --text-muted from common-style.css (not --muted)
    el.hitsList.innerHTML =
      `<div style="color:var(--text-muted);font-size:12px;font-weight:900;padding:8px 2px;">No hits yet.</div>`;
    return;
  }

  for (const h of hits) {
    const div = document.createElement("div");
    div.className = "hitItem";
    div.innerHTML = `
      <div>
        <div class="hitK">Freq (MHz)</div>
        <div class="hitV">${fmtMHz(h.freq_MHz)}</div>
      </div>
      <div>
        <div class="hitK">RSSI</div>
        <div class="hitV">${h.rssi}</div>
      </div>
      <div class="hitWide">
        <span>Code: <b>${h.code}</b></span>
        <span>Bits: <b>${h.bits}</b></span>
        <span style="opacity:.85">Delay: <b>${h.delay_us}</b> µs</span>
      </div>
    `;
    el.hitsList.appendChild(div);
  }
}

function addHit(msg) {
  hits.unshift({
    freq_MHz: msg.freq_MHz,
    rssi: msg.rssi,
    code: msg.code,
    bits: msg.bits,
    delay_us: msg.delay_us,
  });
  hits = hits.slice(0, MAX_HITS);
  renderHits();
}

function fillCombos() {
  el.stepSelect.innerHTML = "";
  STEP_OPTIONS.forEach(v => {
    const opt = document.createElement("option");
    opt.value = String(v);
    opt.textContent = `${v} MHz`;
    el.stepSelect.appendChild(opt);
  });
  el.stepSelect.value = "0.25";

  el.dwellSelect.innerHTML = "";
  DWELL_OPTIONS.forEach(ms => {
    const opt = document.createElement("option");
    opt.value = String(ms);
    opt.textContent = `${ms} ms`;
    el.dwellSelect.appendChild(opt);
  });
  el.dwellSelect.value = "20";
}

function bindUI() {
  // Back button (NEW): always returns to Add Device
  if (el.backBtn) {
    el.backBtn.addEventListener("click", () => {
      // If we came from addDevice, prefer history back; otherwise go directly
      if (document.referrer && document.referrer.includes("addDevice")) {
        history.back();
      } else {
        window.location.href = ADD_DEVICE_PAGE;
      }
    });
  }

  // snap during input for both sliders
  el.minSlider.addEventListener("input", updateFillAndText);
  el.maxSlider.addEventListener("input", updateFillAndText);

  // when step changes: apply to slider step and snap values
  el.stepSelect.addEventListener("change", () => {
    const stepMHz = getStepMHz();
    applyStepToSliders(stepMHz);
    updateFillAndText();
  });

  el.dwellSelect.addEventListener("change", updateFillAndText);

  el.searchBtn.addEventListener("click", () => {
    if (!ws || !ws.isConnected) {
      setStatus("bad", "Disconnected");
      return;
    }
    if (scanning) return;

    const stepMHz = getStepMHz();
    applyStepToSliders(stepMHz);
    updateFillAndText();

    const start = Number(el.minSlider.value);
    const end   = Number(el.maxSlider.value);
    const dwell = Number(el.dwellSelect.value);

    if (!validateRange(start, end)) {
      el.errorBox.classList.add("show");
      lockControls(false);
      return;
    }

    scanning = true;
    setStatus("scan", "Scanning...");
    lockControls(true);
    setProgress(0);
    setSegment(1, 1);

    ws.remoteScanStart({ start, end, step: stepMHz, dwell });
  });
}

function bindWSEvents() {
  window.addEventListener("ws-status", (e) => {
    const c = !!e.detail?.connected;
    setStatus(c ? "ok" : "bad", c ? "Ready" : "Disconnected");
    if (!c) {
      scanning = false;
      lockControls(false);
    }
  });

  window.addEventListener("remote-scan:read", (e) => {
    const d = e.detail || {};
    const start = clamp(Number(d.RF_SCAN_START_MHZ), MIN_MHZ, MAX_MHZ);
    const end   = clamp(Number(d.RF_SCAN_END_MHZ), MIN_MHZ, MAX_MHZ);

    // Step/dwell might be values not in our initial list, so add them
    ensureOption(el.stepSelect, Number(d.RF_SCAN_STEP_MHZ), `${Number(d.RF_SCAN_STEP_MHZ)} MHz`);
    ensureOption(el.dwellSelect, Number(d.RF_SCAN_DWELL_MS), `${Number(d.RF_SCAN_DWELL_MS)} ms`);

    // apply step to sliders + snap
    const stepMHz = getStepMHz();
    el.minSlider.value = String(start);
    el.maxSlider.value = String(end);
    applyStepToSliders(stepMHz);

    updateFillAndText();
  });

  window.addEventListener("remote-scan:progress", (e) => {
    const d = e.detail || {};
    setProgress(d.progress ?? 0);
    setLastFreq(d.lastFrequencyMHz);
    setSegment(d.segmentNumber ?? 1, d.segmentTotal ?? 1);
  });

  window.addEventListener("remote-scan:found", () => flashRing());
  window.addEventListener("remote-scan:hit", (e) => { flashRing(); addHit(e.detail || {}); });

  window.addEventListener("remote-scan:done", () => {
    scanning = false;
    setStatus("ok", "Ready");
    lockControls(false);
  });
}

function bootWS() {
  ws = connectWebSocket({
    onOpen: () => {
      setStatus("ok", "Ready");
      ws.remoteScanRead();
    },
    onClose: () => setStatus("bad", "Disconnected"),
    onError: () => setStatus("bad", "Error"),
  });
}

document.addEventListener("DOMContentLoaded", () => {
  fillCombos();

  // defaults
  el.minSlider.value = String(MIN_MHZ);
  el.maxSlider.value = String(MIN_MHZ + 50);

  // apply default step
  applyStepToSliders(getStepMHz());

  updateFillAndText();

  // ✅ IMPORTANT: keep 0 if you want, but for visibility on load set 1
  setProgress(1);

  setLastFreq(null);
  setSegment(1, 1);
  renderHits();

  bindUI();
  bindWSEvents();
  bootWS();
});
