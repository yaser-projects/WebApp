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

/**
 * Show/hide spinner
 */
function showSpinner() {
  spinner.classList.remove('hidden');
}

function hideSpinner() {
  spinner.classList.add('hidden');
}

/**
 * Show step
 */
function showStep(stepNum) {
  currentStep = stepNum;
  steps.forEach((step, idx) => {
    step.classList.toggle('active', idx + 1 === stepNum);
  });
  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx + 1 === stepNum);
  });

  // Auto-load data when entering steps
  if (stepNum === 2 && ws && ws.isConnected) {
    loadAPSettings();
  }
  if (stepNum === 3 && ws && ws.isConnected) {
    loadStationSettings();
  }
  if (stepNum === 5 && ws && ws.isConnected) {
    loadSummary();
  }
}

/**
 * Send WebSocket message and wait for response
 */
function sendWSMessage(message, timeout = 5000, matcher = null) {
  return new Promise((resolve, reject) => {
    if (!ws || !ws.isConnected) {
      reject(new Error('WebSocket not connected'));
      return;
    }

    const originalOnJSON = ws.handlers.onJSON;
    let handlerRestored = false;

    const restoreHandler = () => {
      if (!handlerRestored) {
        handlerRestored = true;
        ws.handlers.onJSON = originalOnJSON;
      }
    };

    const timeoutId = setTimeout(() => {
      restoreHandler();
      reject(new Error('Timeout waiting for response'));
    }, timeout);

    ws.handlers.onJSON = (data) => {
      // If matcher provided, check if this is the expected response
      if (matcher && !matcher(data)) {
        // Not the expected response, keep waiting
        // But still call original handler for other processing
        if (originalOnJSON) {
          originalOnJSON(data, ws);
        }
        return;
      }
      
      clearTimeout(timeoutId);
      restoreHandler();
      resolve(data);
    };

    ws.sendJSON(message);
  });
}

/**
 * Validate Step 2: Access Point
 */
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

/**
 * Validate Step 3: Station Mode
 */
function validateStation() {
  if (!staHasInternet.checked) {
    return true; // No validation needed if internet checkbox is off
  }

  let isValid = true;
  staSsidError.textContent = '';
  staPassError.textContent = '';
  staSsid.classList.remove('error');
  staPass.classList.remove('error');

  const ssid = staSsid.value.trim();
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

// Global scan result handler
let scanResultHandler = null;

/**
 * Initialize WebSocket connection
 */
function initWebSocket() {
  ws = connectWebSocket({
    onOpen: () => {
      console.log('[QuickStart] WebSocket connected');
      // Load AP settings when entering step 2
      if (currentStep === 2) {
        loadAPSettings();
      }
    },
    onJSON: (data) => {
      console.log('[QuickStart] Received:', data);
      
      // Check if this is a scan result
      if (data['Scan Networks'] !== undefined && scanResultHandler) {
        scanResultHandler(data);
        scanResultHandler = null;
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

/**
 * Load Access Point settings (Step 2)
 */
async function loadAPSettings() {
  try {
    showSpinner();
    const response = await sendWSMessage({
      setting: "device",
      action: "read",
      fields: ["AP SSID", "AP Pre-Shared Key"]
    }, 5000);

    if (response['AP SSID'] !== undefined) {
      apSsid.value = response['AP SSID'] || '';
      deviceState['AP SSID'] = response['AP SSID'] || '';
    }
    if (response['AP Pre-Shared Key'] !== undefined) {
      apPass.value = response['AP Pre-Shared Key'] || '';
      deviceState['AP Pre-Shared Key'] = response['AP Pre-Shared Key'] || '';
    }
    hideSpinner();
  } catch (error) {
    console.error('[QuickStart] Failed to load AP settings:', error);
    hideSpinner();
  }
}

/**
 * Load Station settings (Step 3)
 */
async function loadStationSettings() {
  try {
    showSpinner();
    const response = await sendWSMessage({
      setting: "device",
      action: "read",
      fields: ["Modem SSID", "Modem Pre-Shared Key"]
    }, 5000);

    if (response['Modem SSID'] !== undefined) {
      deviceState['Modem SSID'] = response['Modem SSID'] || '';
      // Add to select if exists
      if (deviceState['Modem SSID']) {
        const option = document.createElement('option');
        option.value = deviceState['Modem SSID'];
        option.textContent = deviceState['Modem SSID'];
        staSsid.appendChild(option);
        staSsid.value = deviceState['Modem SSID'];
      }
    }
    if (response['Modem Pre-Shared Key'] !== undefined) {
      staPass.value = response['Modem Pre-Shared Key'] || '';
      deviceState['Modem Pre-Shared Key'] = response['Modem Pre-Shared Key'] || '';
    }
    hideSpinner();
  } catch (error) {
    console.error('[QuickStart] Failed to load Station settings:', error);
    hideSpinner();
  }
}

/**
 * Scan WiFi networks
 */
async function scanNetworks() {
  try {
    showSpinner();
    
    // First scan request - wait for "Succeed" or "busy" response
    let response = await sendWSMessage({
      setting: "command",
      action: "push button",
      fields: {"Scan Networks": true}
    }, 3000, (data) => {
      // Match for initial response (Succeed or busy)
      return (data.error !== undefined || data.message !== undefined);
    });

    console.log('[QuickStart] Scan initial response:', response);

    // Check if busy
    if (response.error && response.message === "WiFi scan busy") {
      // Wait and try again
      await new Promise(resolve => setTimeout(resolve, 2000));
      response = await sendWSMessage({
        setting: "command",
        action: "push button",
        fields: {"Scan Networks": true}
      }, 3000, (data) => {
        return (data.error !== undefined || data.message !== undefined);
      });
    }

    // Check if scan results came in the first response
    if (response['Scan Networks']) {
      processScanResults(response['Scan Networks']);
      hideSpinner();
      return;
    }

    // Otherwise, wait for scan results in a separate message
    // Set up handler to catch scan results
    const scanPromise = new Promise((resolve, reject) => {
      scanResultHandler = (data) => {
        if (data && data['Scan Networks'] !== undefined) {
          resolve(data['Scan Networks']);
        } else {
          reject(new Error('No scan results received'));
        }
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        if (scanResultHandler) {
          scanResultHandler = null;
          reject(new Error('Timeout waiting for scan results'));
        }
      }, 10000);
    });

    try {
      const networks = await scanPromise;
      processScanResults(networks);
    } catch (error) {
      console.error('[QuickStart] Failed to get scan results:', error);
      // Try reading directly
      try {
        const readResponse = await sendWSMessage({
          setting: "device",
          action: "read",
          fields: ["Scan Networks"]
        }, 5000);
        
        if (readResponse['Scan Networks']) {
          processScanResults(readResponse['Scan Networks']);
        } else {
          throw new Error('No networks in read response');
        }
      } catch (readError) {
        console.error('[QuickStart] Read scan results failed:', readError);
        alert('Failed to get scan results. Please try again.');
      }
    }
    
    hideSpinner();
  } catch (error) {
    console.error('[QuickStart] Scan failed:', error);
    hideSpinner();
    if (scanResultHandler) {
      scanResultHandler = null;
    }
    alert('Failed to scan networks. Please try again.');
  }
}

/**
 * Process and display scan results
 */
function processScanResults(networks) {
  // Clear existing options
  staSsid.innerHTML = '<option value="">(Select or type)</option>';
  
  if (!networks) {
    console.warn('[QuickStart] No networks data');
    return;
  }

  if (typeof networks === 'string' && networks === "No Wi-Fi networks found") {
    // Allow manual input
    staSsid.innerHTML = '<option value="">(Type manually)</option>';
    console.log('[QuickStart] No networks found');
    return;
  }

  if (Array.isArray(networks) && networks.length > 0) {
    networks.forEach((network, index) => {
      // Network format: ["SSID", "RSSI", "SECURITY"] or just "SSID"
      let ssid;
      if (Array.isArray(network)) {
        ssid = network[0]; // First element is SSID
      } else if (typeof network === 'string') {
        ssid = network;
      } else {
        console.warn(`[QuickStart] Invalid network format at index ${index}:`, network);
        return; // Skip invalid entries
      }

      if (ssid && ssid.trim()) {
        const option = document.createElement('option');
        option.value = ssid.trim();
        option.textContent = ssid.trim();
        staSsid.appendChild(option);
      }
    });
    
    console.log(`[QuickStart] Added ${networks.length} networks to dropdown`);
  } else {
    console.warn('[QuickStart] Unexpected scan result format:', networks);
  }
}

/**
 * Load summary data (Step 5)
 */
async function loadSummary() {
  try {
    showSpinner();
    const response = await sendWSMessage({
      setting: "device",
      action: "read",
      fields: ["AP SSID", "AP Pre-Shared Key", "Modem SSID", "Modem Pre-Shared Key"]
    }, 5000);

    summaryAPSSID.textContent = response['AP SSID'] || '-';
    summaryAPPsk.textContent = response['AP Pre-Shared Key'] || '-';
    summaryModemSSID.textContent = response['Modem SSID'] || '-';
    summaryModemPsk.textContent = response['Modem Pre-Shared Key'] || '-';
    
    const modeParts = [];
    if (modeAp.checked) modeParts.push('AP');
    if (modeSta.checked) modeParts.push('STA');
    summaryMode.textContent = modeParts.length > 0 ? modeParts.join(' + ') : '-';
    
    hideSpinner();
  } catch (error) {
    console.error('[QuickStart] Failed to load summary:', error);
    hideSpinner();
  }
}

// ===== Event Handlers =====

// Step 1: Start
btnStart.addEventListener('click', async () => {
  showSpinner();
  await new Promise(resolve => setTimeout(resolve, 1000));
  hideSpinner();
  showStep(2);
  if (ws && ws.isConnected) {
    loadAPSettings();
  }
});

// Step 2: Access Point - Next
btnApNext.addEventListener('click', async () => {
  if (!validateAP()) {
    return;
  }

  showSpinner();
  
  try {
    const response = await sendWSMessage({
      setting: "device",
      action: "write",
      fields: {
        "AP SSID": apSsid.value.trim(),
        "AP Pre-Shared Key": apPass.value.trim()
      }
    }, 10000);

    if (response.error === false || response.message) {
      deviceState['AP SSID'] = apSsid.value.trim();
      deviceState['AP Pre-Shared Key'] = apPass.value.trim();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      hideSpinner();
      showStep(3);
      
      if (ws && ws.isConnected) {
        loadStationSettings();
      }
    } else {
      throw new Error('Failed to save AP settings');
    }
  } catch (error) {
    console.error('[QuickStart] Save AP failed:', error);
    alert('Failed to save Access Point settings. Please try again.');
    hideSpinner();
  }
});

// Step 3: Station Mode - Internet checkbox
staHasInternet.addEventListener('change', () => {
  const enabled = staHasInternet.checked;
  staSsid.disabled = !enabled;
  staPass.disabled = !enabled;

  if (!enabled) {
    staSsid.value = '';
    staPass.value = '';
  } else {
    // Restore saved values if any
    if (deviceState['Modem SSID']) {
      staSsid.value = deviceState['Modem SSID'];
    }
    if (deviceState['Modem Pre-Shared Key']) {
      staPass.value = deviceState['Modem Pre-Shared Key'];
    }
  }
});

// Step 3: Station Mode - SSID dropdown focus/click (scan)
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
    // Only trigger if clicking on the select itself, not an option
    if (e.target === staSsid) {
      scanTriggered = true;
      await scanNetworks();
      scanTriggered = false;
    }
  }
});

// Step 3: Station Mode - Previous
btnStaPrev.addEventListener('click', async () => {
  showSpinner();
  await new Promise(resolve => setTimeout(resolve, 500));
  hideSpinner();
  showStep(2);
});

// Step 3: Station Mode - Next
btnStaNext.addEventListener('click', async () => {
  if (!validateStation()) {
    return;
  }

  showSpinner();

  try {
    const response = await sendWSMessage({
      setting: "device",
      action: "write",
      fields: {
        "Modem SSID": staSsid.value.trim(),
        "Modem Pre-Shared Key": staPass.value.trim()
      }
    }, 10000);

    if (response.error === false || response.message) {
      deviceState['Modem SSID'] = staSsid.value.trim();
      deviceState['Modem Pre-Shared Key'] = staPass.value.trim();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      hideSpinner();
      showStep(4);
      
      // Enforce mode rules
      enforceModeRules();
    } else {
      throw new Error('Failed to save Station settings');
    }
  } catch (error) {
    console.error('[QuickStart] Save Station failed:', error);
    alert('Failed to save Station settings. Please try again.');
    hideSpinner();
  }
});

// Step 4: Select Mode - Enforce rules
function enforceModeRules() {
  if (!staHasInternet.checked) {
    // If no internet, only AP mode available
    modeAp.checked = true;
    modeAp.disabled = false;
    modeSta.checked = false;
    modeSta.disabled = true;
  } else {
    // Both modes available
    modeAp.disabled = false;
    modeSta.disabled = false;
  }
  
  // Ensure at least one is selected
  if (!modeAp.checked && !modeSta.checked) {
    modeAp.checked = true;
  }
}

modeAp.addEventListener('change', () => {
  if (!modeAp.checked && !modeSta.checked) {
    modeSta.checked = true; // Keep at least one selected
  }
});

modeSta.addEventListener('change', () => {
  if (!modeAp.checked && !modeSta.checked) {
    modeAp.checked = true; // Keep at least one selected
  }
});

// Step 4: Select Mode - Previous
btnModePrev.addEventListener('click', async () => {
  showSpinner();
  await new Promise(resolve => setTimeout(resolve, 500));
  hideSpinner();
  showStep(3);
});

// Step 4: Select Mode - Next
btnModeNext.addEventListener('click', async () => {
  showSpinner();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Send mode selection commands
  const fields = {};
  if (modeAp.checked) fields['AP Button'] = true;
  if (modeSta.checked) fields['STA Button'] = true;

  try {
    await sendWSMessage({
      setting: "command",
      action: "push button",
      fields: fields
    }, 5000);
  } catch (error) {
    console.error('[QuickStart] Mode selection failed:', error);
  }

  hideSpinner();
  showStep(5);
  loadSummary();
});

// Step 5: Device Config - Previous
btnFinishPrev.addEventListener('click', async () => {
  showSpinner();
  await new Promise(resolve => setTimeout(resolve, 500));
  hideSpinner();
  showStep(4);
});

// Step 5: Device Config - Finish
btnFinish.addEventListener('click', async () => {
  showSpinner();
  await new Promise(resolve => setTimeout(resolve, 500));

  // Send final mode commands
  const fields = {};
  if (modeAp.checked) fields['AP Button'] = true;
  if (modeSta.checked) fields['STA Button'] = true;

  try {
    await sendWSMessage({
      setting: "command",
      action: "push button",
      fields: fields
    }, 5000);

    // Wait 3 seconds for device to apply settings
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    hideSpinner();
    // Redirect to login
    window.location.href = 'index.html';
  } catch (error) {
    console.error('[QuickStart] Finish failed:', error);
    alert('Failed to apply settings. Please try again.');
    hideSpinner();
  }
});

// Initialize
initWebSocket();
showStep(1);

