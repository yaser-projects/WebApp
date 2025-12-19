// ============================================
// Metal Brain - QuickStart Wizard
// ============================================

import { connectWebSocket } from './ws.js';

// State
let currentStep = 1;
const totalSteps = 5;
let ws = null;

let deviceState = {
  'AP SSID': '',
  'AP Pre-Shared Key': '',
  'Modem SSID': '',
  'Modem Pre-Shared Key': '',
  modeAP: false,
  modeSTA: false
};

// DOM Elements
const steps = document.querySelectorAll('.qs-step');
const dots = document.querySelectorAll('.dot');
const spinner = document.getElementById('qsSpinner');

// Step 1
const btnStart = document.getElementById('btnStart');

// Step 2
const apHidden = document.getElementById('apHidden');
const apSsid = document.getElementById('apSsid');
const apPass = document.getElementById('apPass');
const apSsidError = document.getElementById('apSsidError');
const apPassError = document.getElementById('apPassError');
const btnApNext = document.getElementById('btnApNext');

// Step 3
const staHasInternet = document.getElementById('staHasInternet');
const staSsid = document.getElementById('staSsid');
const staPass = document.getElementById('staPass');
const staSsidError = document.getElementById('staSsidError');
const staPassError = document.getElementById('staPassError');
const btnStaPrev = document.getElementById('btnStaPrev');
const btnStaNext = document.getElementById('btnStaNext');

// Step 4
const modeAp = document.getElementById('modeAp');
const modeSta = document.getElementById('modeSta');
const selectModeError = document.getElementById('selectModeError');
const btnModePrev = document.getElementById('btnModePrev');
const btnModeNext = document.getElementById('btnModeNext');

// Step 5
const summaryAPSSID = document.getElementById('summaryAPSSID');
const summaryAPPsk = document.getElementById('summaryAPPsk');
const summaryModemSSID = document.getElementById('summaryModemSSID');
const summaryModemPsk = document.getElementById('summaryModemPsk');
const summaryMode = document.getElementById('summaryMode');
const btnFinishPrev = document.getElementById('btnFinishPrev');
const btnFinish = document.getElementById('btnFinish');

// -------------------------
// Spinner
// -------------------------
function showSpinner() {
  if (spinner) spinner.classList.remove('hidden');
}
function hideSpinner() {
  if (spinner) spinner.classList.add('hidden');
}

// -------------------------
// Helpers
// -------------------------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildModeText() {
  const ap = !!deviceState.modeAP;
  const sta = !!deviceState.modeSTA;
  if (ap && sta) return 'Access Point + Station';
  if (ap) return 'Access Point';
  if (sta) return 'Station';
  return '-';
}

// -------------------------
// Step Rendering
// -------------------------
function showStep(stepNum) {
  currentStep = stepNum;

  steps.forEach((step, idx) => {
    step.classList.toggle('active', idx + 1 === stepNum);
  });

  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx + 1 === stepNum);
  });

  // Auto-load data when entering steps
  if (ws && ws.isConnected) {
    if (stepNum === 2) loadAPSettings();
    if (stepNum === 3) loadStationSettings();
    if (stepNum === 5) loadSummary(); // ✅ Step 5 must always trigger read
  }
}

// -------------------------
// ✅ Safe WS "waiter" system (NO handler override)
// -------------------------
const pendingWS = []; // { matcher, resolve, reject, timeoutId }

function dispatchPending(data) {
  if (!pendingWS.length) return;

  for (let i = 0; i < pendingWS.length; i++) {
    const p = pendingWS[i];
    try {
      if (!p.matcher || p.matcher(data)) {
        clearTimeout(p.timeoutId);
        pendingWS.splice(i, 1);
        p.resolve(data);
        return;
      }
    } catch (e) {
      // ignore matcher errors
    }
  }
}

function waitForWS(matcher, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const idx = pendingWS.findIndex((x) => x.resolve === resolve);
      if (idx >= 0) pendingWS.splice(idx, 1);
      reject(new Error('Timeout waiting for response'));
    }, timeout);

    pendingWS.push({ matcher, resolve, reject, timeoutId });
  });
}

/**
 * Send WebSocket message and wait for response (SAFE)
 */
async function sendWSMessage(message, timeout = 5000, matcher = null) {
  if (!ws || !ws.isConnected) throw new Error('WebSocket not connected');
  ws.sendJSON(message);
  const data = await waitForWS(matcher, timeout);
  return data;
}

// -------------------------
// Validation
// -------------------------
function validateAP() {
  let isValid = true;
  apSsidError.textContent = '';
  apPassError.textContent = '';
  apSsid.classList.remove('error');
  apPass.classList.remove('error');

  const ssid = apSsid.value.trim();
  const pass = apPass.value.trim();

  if (ssid.length === 0 || ssid.length > 32) {
    apSsidError.textContent = 'SSID must be 1-32 characters';
    apSsid.classList.add('error');
    isValid = false;
  } else if (ssid.toLowerCase() === 'metal brain') {
    apSsidError.textContent = 'SSID cannot be "Metal Brain"';
    apSsid.classList.add('error');
    isValid = false;
  }

  if (pass.length < 8 || pass.length > 64) {
    apPassError.textContent = 'Pre-Shared Key must be 8-64 characters';
    apPass.classList.add('error');
    isValid = false;
  }

  return isValid;
}

function validateStation() {
  if (!staHasInternet.checked) return true;

  let isValid = true;
  staSsidError.textContent = '';
  staPassError.textContent = '';
  staSsid.classList.remove('error');
  staPass.classList.remove('error');

  const ssid = (staSsid.value || '').trim();
  const pass = staPass.value.trim();

  if (ssid.length === 0 || ssid.length > 32) {
    staSsidError.textContent = 'SSID must be 1-32 characters';
    staSsid.classList.add('error');
    isValid = false;
  }

  if (pass.length > 64) {
    staPassError.textContent = 'Pre-Shared Key must be 0-64 characters';
    staPass.classList.add('error');
    isValid = false;
  }

  return isValid;
}

// -------------------------
// Scan support
// -------------------------
let scanResultHandler = null;
let lastScanNetworks = null;
let scanFallbackTimer = null;

function enableManualSSIDMode() {
  if (!staSsid) return;
  staSsid.disabled = false;
  staSsid.innerHTML = `
    <option value="">(Select)</option>
    <option value="__manual__">Type manually...</option>
  `;
  console.log('[QuickStart] Manual SSID mode enabled');
}

function processScanResults(networks) {
  staSsid.innerHTML = '<option value="">(Select or type)</option>';

  const manualOpt = document.createElement('option');
  manualOpt.value = '__manual__';
  manualOpt.textContent = 'Type manually...';
  staSsid.appendChild(manualOpt);

  if (!networks) return;

  if (typeof networks === 'string' && networks === "No Wi-Fi networks found") {
    return;
  }

  if (Array.isArray(networks)) {
    networks.forEach((network) => {
      let ssid = '';
      if (Array.isArray(network)) ssid = network[0] || '';
      else if (typeof network === 'string') ssid = network;

      ssid = (ssid || '').trim();
      if (!ssid) return;

      const option = document.createElement('option');
      option.value = ssid;
      option.textContent = ssid;
      staSsid.appendChild(option);
    });
  }
}

async function scanNetworks() {
  try {
    showSpinner();

    if (scanFallbackTimer) clearTimeout(scanFallbackTimer);
    scanFallbackTimer = setTimeout(() => {
      hideSpinner();
      enableManualSSIDMode();
    }, 4000);

    // initial trigger
    let response = await sendWSMessage(
      {
        setting: "command",
        action: "push button",
        fields: { "Scan Networks": true }
      },
      3000,
      (data) => data && (data.error !== undefined || data.message !== undefined || data["Scan Networks"] !== undefined)
    );

    // if results came immediately
    if (response && response["Scan Networks"] !== undefined) {
      processScanResults(response["Scan Networks"]);
      hideSpinner();
      return;
    }

    // busy retry
    if (response && response.error && response.message === "WiFi scan busy") {
      await sleep(2000);
      await sendWSMessage(
        {
          setting: "command",
          action: "push button",
          fields: { "Scan Networks": true }
        },
        3000,
        (data) => data && (data.error !== undefined || data.message !== undefined)
      );
    }

    // wait for async scan result
    const networks = await new Promise((resolve, reject) => {
      scanResultHandler = (data) => {
        if (data && data["Scan Networks"] !== undefined) resolve(data["Scan Networks"]);
        else reject(new Error('No scan results received'));
      };
      setTimeout(() => {
        scanResultHandler = null;
        reject(new Error('Timeout waiting scan result'));
      }, 10000);
    });

    processScanResults(networks);
    hideSpinner();
  } catch (e) {
    console.error('[QuickStart] Scan failed:', e);
    hideSpinner();
    enableManualSSIDMode();
  }
}

// -------------------------
// WebSocket init
// -------------------------
function initWebSocket() {
  ws = connectWebSocket({
    onOpen: () => {
      console.log('[QuickStart] WebSocket connected');
      // auto-load current step on connect
      if (currentStep === 2) loadAPSettings();
      if (currentStep === 3) loadStationSettings();
      if (currentStep === 5) loadSummary(); // ✅
    },
    onJSON: (data) => {
      console.log('[QuickStart] Received:', data);

      // 1) resolve pending promises first
      dispatchPending(data);

      // 2) scan result pipeline
      if (data && data['Scan Networks'] !== undefined) {
        lastScanNetworks = data['Scan Networks'];
        processScanResults(lastScanNetworks);

        if (scanResultHandler) {
          scanResultHandler(data);
          scanResultHandler = null;
        }
        if (scanFallbackTimer) {
          clearTimeout(scanFallbackTimer);
          scanFallbackTimer = null;
        }
      }
    },
    onError: () => {
      console.error('[QuickStart] WebSocket error');
      if (scanResultHandler) {
        scanResultHandler(null);
        scanResultHandler = null;
      }
    },
    onClose: () => {
      console.log('[QuickStart] WebSocket closed');
    }
  });
}

// -------------------------
// Step 2 Load
// -------------------------
async function loadAPSettings() {
  try {
    showSpinner();
    const response = await sendWSMessage(
      {
        setting: "device",
        action: "read",
        fields: ["AP SSID", "AP Pre-Shared Key"]
      },
      5000,
      (data) => data && (data["AP SSID"] !== undefined || data["AP Pre-Shared Key"] !== undefined)
    );

    apSsid.value = response["AP SSID"] ?? '';
    apPass.value = response["AP Pre-Shared Key"] ?? '';
    deviceState["AP SSID"] = apSsid.value;
    deviceState["AP Pre-Shared Key"] = apPass.value;
  } catch (e) {
    console.error('[QuickStart] Failed to load AP settings:', e);
  } finally {
    hideSpinner();
  }
}

// -------------------------
// Step 3 Load
// -------------------------
async function loadStationSettings() {
  try {
    showSpinner();
    const response = await sendWSMessage(
      {
        setting: "device",
        action: "read",
        fields: ["Modem SSID", "Modem Pre-Shared Key"]
      },
      5000,
      (data) => data && (data["Modem SSID"] !== undefined || data["Modem Pre-Shared Key"] !== undefined)
    );

    deviceState["Modem SSID"] = response["Modem SSID"] ?? '';
    deviceState["Modem Pre-Shared Key"] = response["Modem Pre-Shared Key"] ?? '';

    // put saved SSID in select if exists
    if (deviceState["Modem SSID"]) {
      const opt = document.createElement('option');
      opt.value = deviceState["Modem SSID"];
      opt.textContent = deviceState["Modem SSID"];
      staSsid.appendChild(opt);
      staSsid.value = deviceState["Modem SSID"];
    }

    staPass.value = deviceState["Modem Pre-Shared Key"] ?? '';
  } catch (e) {
    console.error('[QuickStart] Failed to load Station settings:', e);
  } finally {
    hideSpinner();
  }
}

// -------------------------
// ✅ Step 5 Load (Device Config) - per spec
// -------------------------
// -------------------------
// ✅ Step 5 Load (Device Config) - FIX: collect AP + STA responses
// -------------------------
async function loadSummary() {
  try {
    showSpinner();

    // 1) درخواست خواندن همه مقادیر
    ws.sendJSON({
      setting: "device",
      action: "read",
      fields: ["AP SSID", "AP Pre-Shared Key", "Modem SSID", "Modem Pre-Shared Key"]
    });

    // 2) چون ws.js ممکنه جواب AP و STA رو جدا جدا بفرسته،
    // باید هرچی میاد رو جمع کنیم تا همه فیلدها پر بشن.
    const collected = {
      "AP SSID": undefined,
      "AP Pre-Shared Key": undefined,
      "Modem SSID": undefined,
      "Modem Pre-Shared Key": undefined,
    };

    const deadline = Date.now() + 6000;

    while (Date.now() < deadline) {
      const data = await waitForWS(
        (d) =>
          d &&
          (d["AP SSID"] !== undefined ||
           d["AP Pre-Shared Key"] !== undefined ||
           d["Modem SSID"] !== undefined ||
           d["Modem Pre-Shared Key"] !== undefined),
        Math.max(250, deadline - Date.now())
      );

      // Merge
      ["AP SSID", "AP Pre-Shared Key", "Modem SSID", "Modem Pre-Shared Key"].forEach((k) => {
        if (data[k] !== undefined) collected[k] = data[k];
      });

      const gotAP  = (collected["AP SSID"] !== undefined) || (collected["AP Pre-Shared Key"] !== undefined);
      const gotSTA = (collected["Modem SSID"] !== undefined) || (collected["Modem Pre-Shared Key"] !== undefined);

      // وقتی هر دو گروه رسیدن، تموم
      if (gotAP && gotSTA) break;
    }

    // 3) نمایش (با fallback روی deviceState)
    summaryAPSSID.textContent     = collected["AP SSID"] ?? deviceState["AP SSID"] ?? "-";
    summaryAPPsk.textContent      = collected["AP Pre-Shared Key"] ?? deviceState["AP Pre-Shared Key"] ?? "-";
    summaryModemSSID.textContent  = collected["Modem SSID"] ?? deviceState["Modem SSID"] ?? "-";
    summaryModemPsk.textContent   = collected["Modem Pre-Shared Key"] ?? deviceState["Modem Pre-Shared Key"] ?? "-";

    // Mode from Step 4 selection
    summaryMode.textContent = buildModeText();
  } catch (e) {
    console.error('[QuickStart] Failed to load summary:', e);

    // fallback safe
    summaryAPSSID.textContent     = deviceState["AP SSID"] || "-";
    summaryAPPsk.textContent      = deviceState["AP Pre-Shared Key"] || "-";
    summaryModemSSID.textContent  = deviceState["Modem SSID"] || "-";
    summaryModemPsk.textContent   = deviceState["Modem Pre-Shared Key"] || "-";
    summaryMode.textContent       = buildModeText();
  } finally {
    hideSpinner();
  }
}


// -------------------------
// Step 4 Mode rules
// -------------------------
function enforceModeRules() {
  if (!staHasInternet.checked) {
    modeAp.checked = true;
    modeAp.disabled = false;
    modeSta.checked = false;
    modeSta.disabled = true;
  } else {
    modeAp.disabled = false;
    modeSta.disabled = false;
  }

  if (!modeAp.checked && !modeSta.checked) {
    modeAp.checked = true;
  }
}

// -------------------------
// Event Handlers
// -------------------------

// Step 1: Start
btnStart.addEventListener('click', async () => {
  showSpinner();
  await sleep(1000);
  hideSpinner();
  showStep(2);
});

// Step 2: Next
btnApNext.addEventListener('click', async () => {
  if (!validateAP()) return;

  showSpinner();
  try {
    const response = await sendWSMessage(
      {
        setting: "device",
        action: "write",
        fields: {
          "AP SSID": apSsid.value.trim(),
          "AP Pre-Shared Key": apPass.value.trim()
        }
      },
      10000,
      (data) => data && (data.error !== undefined || data.message !== undefined)
    );

    // accept succeed-like responses
    if (response) {
      deviceState["AP SSID"] = apSsid.value.trim();
      deviceState["AP Pre-Shared Key"] = apPass.value.trim();

      await sleep(500);
      hideSpinner();
      showStep(3);
    }
  } catch (e) {
    console.error('[QuickStart] Save AP failed:', e);
    alert('Failed to save Access Point settings. Please try again.');
  } finally {
    hideSpinner();
  }
});

// Step 3: Internet checkbox
staHasInternet.addEventListener('change', () => {
  const enabled = staHasInternet.checked;
  staSsid.disabled = !enabled;
  staPass.disabled = !enabled;

  if (!enabled) {
    staSsid.value = '';
    staPass.value = '';
  } else {
    if (deviceState['Modem SSID']) staSsid.value = deviceState['Modem SSID'];
    if (deviceState['Modem Pre-Shared Key']) staPass.value = deviceState['Modem Pre-Shared Key'];
  }
});

// Manual SSID option
staSsid.addEventListener("change", () => {
  if (staSsid.value === "__manual__") {
    const v = window.prompt("Enter Modem SSID:");
    if (v && v.trim()) {
      const ssid = v.trim();
      const option = document.createElement("option");
      option.value = ssid;
      option.textContent = ssid;
      staSsid.appendChild(option);
      staSsid.value = ssid;
    } else {
      staSsid.value = "";
    }
  }
});

// Scan trigger
let scanTriggered = false;
staSsid.addEventListener('focus', async () => {
  if (staHasInternet.checked && ws && ws.isConnected && !scanTriggered) {
    scanTriggered = true;
    await scanNetworks();
    scanTriggered = false;
  }
});
staSsid.addEventListener('mousedown', async (e) => {
  if (staHasInternet.checked && ws && ws.isConnected && !scanTriggered) {
    if (e.target === staSsid) {
      scanTriggered = true;
      await scanNetworks();
      scanTriggered = false;
    }
  }
});

// Step 3: Previous
btnStaPrev.addEventListener('click', async () => {
  showSpinner();
  await sleep(500);
  hideSpinner();
  showStep(2);
});

// Step 3: Next
btnStaNext.addEventListener('click', async () => {
  if (!validateStation()) return;

  showSpinner();
  try {
    const response = await sendWSMessage(
      {
        setting: "device",
        action: "write",
        fields: {
          "Modem SSID": (staSsid.value || '').trim(),
          "Modem Pre-Shared Key": staPass.value.trim()
        }
      },
      10000,
      (data) => data && (data.error !== undefined || data.message !== undefined)
    );

    if (response) {
      deviceState["Modem SSID"] = (staSsid.value || '').trim();
      deviceState["Modem Pre-Shared Key"] = staPass.value.trim();

      await sleep(500);
      hideSpinner();
      showStep(4);

      enforceModeRules();
    }
  } catch (e) {
    console.error('[QuickStart] Save Station failed:', e);
    alert('Failed to save Station settings. Please try again.');
  } finally {
    hideSpinner();
  }
});

// Step 4: Keep at least one
modeAp.addEventListener('change', () => {
  if (!modeAp.checked && !modeSta.checked) modeSta.checked = true;
});
modeSta.addEventListener('change', () => {
  if (!modeAp.checked && !modeSta.checked) modeAp.checked = true;
});

// Step 4: Previous
btnModePrev.addEventListener('click', async () => {
  showSpinner();
  await sleep(500);
  hideSpinner();
  showStep(3);
});

// Step 4: Next
btnModeNext.addEventListener('click', async () => {
  showSpinner();
  await sleep(1000);

  // ✅ Save mode selection to deviceState for Step 5 display
  deviceState.modeAP = !!modeAp.checked;
  deviceState.modeSTA = !!modeSta.checked;

  const fields = {};
  if (modeAp.checked) fields['AP Button'] = true;
  if (modeSta.checked) fields['STA Button'] = true;

  try {
    // send commands (spec says send selected AP/STA)
    await sendWSMessage(
      {
        setting: "command",
        action: "push button",
        fields
      },
      5000,
      (data) => data && (data.error !== undefined || data.message !== undefined)
    );
  } catch (e) {
    console.error('[QuickStart] Mode selection failed:', e);
  } finally {
    hideSpinner();
  }

  showStep(5); // ✅ will auto load summary (read device)
});

// Step 5: Previous (per spec: 500ms progress, go back)
btnFinishPrev.addEventListener('click', async () => {
  showSpinner();
  await sleep(500);
  hideSpinner();
  showStep(4);
});

// Step 5: Finish (per spec)
btnFinish.addEventListener('click', async () => {
  // 1) progress 500ms
  showSpinner();
  await sleep(500);

  // 2) send selected mode commands
  const fields = {};
  if (deviceState.modeAP) fields['AP Button'] = true;
  if (deviceState.modeSTA) fields['STA Button'] = true;

  try {
    await sendWSMessage(
      {
        setting: "command",
        action: "push button",
        fields
      },
      5000,
      (data) => data && (data.error !== undefined || data.message !== undefined)
    );
  } catch (e) {
    console.error('[QuickStart] Finish command failed:', e);
    // حتی اگر خطا شد، طبق تجربه شما بهتره ادامه نده؛ اما Spec میگه بعد از موفقیت...
    // اینجا خطا بده و اسپینر رو ببند.
    hideSpinner();
    alert('Failed to apply settings. Please try again.');
    return;
  }

  // 3) wait ~3 seconds regardless of success response
  await sleep(3000);

  // 4) hide progress and redirect/reload login
  hideSpinner();
  window.location.href = 'index.html';
});

// Initialize
initWebSocket();
showStep(1);
