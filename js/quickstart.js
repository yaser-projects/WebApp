// =========================
// METAL BRAIN QUICK-START
// Implements the 5-step QuickStart wizard and WebSocket message handling
// =========================

let currentStep = 1;
const totalSteps = 5;

const qsSteps = document.querySelectorAll('.qs-step');
const dots = document.querySelectorAll('.dot');
const centerSpinner = createOrGetSpinner();

function showStep(n) {
    currentStep = n;
    qsSteps.forEach((s, i) => s.classList.toggle('active', i === (n - 1)));
    dots.forEach((d, i) => d.classList.toggle('active', i === (n - 1)));
}

function createOrGetSpinner() {
    let el = document.getElementById('centerSpinner');
    if (!el) {
        el = document.createElement('div');
        el.id = 'centerSpinner';
        el.className = 'center-spinner hidden';
        el.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(el);
    }
    return el;
}

function showCenterSpinner() { centerSpinner.classList.remove('hidden'); }
function hideCenterSpinner() { centerSpinner.classList.add('hidden'); }

// WebSocket helper with basic request/response matching
const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
let ws = null;
let pendingResolvers = [];

function ensureWS() {
    if (ws && ws.readyState === WebSocket.OPEN) return ws;
    ws = new WebSocket(proto + location.host + '/ws');

    ws.onopen = () => console.log('WS Connected');
    ws.onclose = () => console.log('WS Closed');
    ws.onerror = (e) => console.log('WS Error', e);

    ws.onmessage = (ev) => {
        let data;
        try { data = JSON.parse(ev.data); } catch { return; }
        // resolve any pending promises that match expected shape
        pendingResolvers.forEach(pr => {
            try { pr.check(data); } catch (err) { /* ignore */ }
        });
    };

    return ws;
}

function sendAndWait(request, matcher, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const sock = ensureWS();
        const timeoutId = setTimeout(() => {
            // remove resolver
            pendingResolvers = pendingResolvers.filter(r => r !== resolver);
            reject(new Error('Timeout waiting response'));
        }, timeout);

        const resolver = {
            check: (data) => {
                if (matcher(data)) {
                    clearTimeout(timeoutId);
                    pendingResolvers = pendingResolvers.filter(r => r !== resolver);
                    resolve(data);
                }
            }
        };
        pendingResolvers.push(resolver);

        // send when socket open; if not open, wait for open
        if (sock.readyState === WebSocket.OPEN) {
            sock.send(JSON.stringify(request));
        } else {
            sock.addEventListener('open', function onopen() {
                sock.removeEventListener('open', onopen);
                sock.send(JSON.stringify(request));
            });
        }
    });
}

// DOM elements
const startBtn = document.getElementById('startBtn');
const apSsid = document.getElementById('apSsid');
const apPass = document.getElementById('apPass');
const saveAp = document.getElementById('saveAp');

const staHasInternet = document.getElementById('staHasInternet');
const staNetworks = document.getElementById('staNetworks');
const staPass = document.getElementById('staPass');
const saveSta = document.getElementById('saveSta');

const modeAp = document.getElementById('modeAp');
const modeSta = document.getElementById('modeSta');
const nextToStep5 = document.getElementById('nextToStep5');

const finishBtn = document.getElementById('finishBtn');

const summaryAPSSID = document.getElementById('summaryAPSSID') || document.getElementById('summaryBox');
// local storage of values
let deviceState = {
    'AP SSID': '',
    'AP Pre-Shared Key': '',
    'Modem SSID': '',
    'Modem Pre-Shared Key': '',
    modeAP: false,
    modeSTA: false
};

// Utilities: validation
function validateAP() {
    const s = apSsid.value.trim();
    const p = apPass.value.trim();
    const ok = s.length >= 1 && s.length <= 32 && s.toLowerCase() !== 'metal brain' && p.length >= 8 && p.length <= 64;
    return ok;
}

function validateStation() {
    if (!staHasInternet.checked) return true;
    const s = (staNetworks.value || '').trim();
    const p = staPass.value.trim();
    return s.length >= 1 && s.length <= 32 && p.length <= 64;
}

// Step behaviors
startBtn.addEventListener('click', async () => {
    showCenterSpinner();
    // show for 1 second then load next
    await new Promise(r => setTimeout(r, 1000));
    hideCenterSpinner();
    showStep(2);

    // request current AP settings
    try {
        const res = await sendAndWait({ setting: 'device', action: 'read', fields: ['AP SSID','AP Pre-Shared Key'] }, d => d['AP SSID'] !== undefined || d['AP Pre-Shared Key'] !== undefined, 5000);
        if (res['AP SSID'] !== undefined) {
            apSsid.value = res['AP SSID'];
            deviceState['AP SSID'] = res['AP SSID'];
        }
        if (res['AP Pre-Shared Key'] !== undefined) {
            apPass.value = res['AP Pre-Shared Key'];
            deviceState['AP Pre-Shared Key'] = res['AP Pre-Shared Key'];
        }
    } catch (err) {
        console.log('No AP settings received', err);
    }
});

// Access Point -> Next
saveAp.addEventListener('click', async () => {
    // inline validation
    if (!validateAP()) {
        alert('AP inputs invalid. SSID 1-32 chars (not "Metal Brain"), PSK 8-64 chars.');
        return;
    }

    showCenterSpinner();
    // send write and wait for confirmation
    try {
        const req = { setting: 'device', action: 'write', fields: { 'AP SSID': apSsid.value.trim(), 'AP Pre-Shared Key': apPass.value.trim() } };
        const resp = await sendAndWait(req, d => d.error === false || d.message !== undefined, 10000);
        // update local state
        deviceState['AP SSID'] = apSsid.value.trim();
        deviceState['AP Pre-Shared Key'] = apPass.value.trim();
        console.log('AP saved', resp);
    } catch (err) {
        console.error('Failed to save AP', err);
        alert('Failed to save AP settings');
        hideCenterSpinner();
        return;
    }

    hideCenterSpinner();
    showStep(3);

    // on entering Station step request modem settings
    try {
        const res = await sendAndWait({ setting: 'device', action: 'read', fields: ['Modem SSID','Modem Pre-Shared Key'] }, d => d['Modem SSID'] !== undefined || d['Modem Pre-Shared Key'] !== undefined, 5000);
        if (res['Modem SSID'] !== undefined) deviceState['Modem SSID'] = res['Modem SSID'];
        if (res['Modem Pre-Shared Key'] !== undefined) deviceState['Modem Pre-Shared Key'] = res['Modem Pre-Shared Key'];
        // populate
        if (deviceState['Modem SSID']) {
            // add as first option
            staNetworks.innerHTML = `<option value="${deviceState['Modem SSID']}">${deviceState['Modem SSID']}</option>` + staNetworks.innerHTML;
        }
    } catch (err) {
        console.log('No modem values received', err);
    }
});

// Station: checkbox toggles fields
staHasInternet.addEventListener('change', () => {
    const enabled = staHasInternet.checked;
    staNetworks.disabled = !enabled;
    staPass.disabled = !enabled;
    if (!enabled) {
        // clear inputs
        staNetworks.value = '';
        staPass.value = '';
    } else {
        // restore previously known modem SSID if any
        if (deviceState['Modem SSID']) {
            const opt = document.createElement('option');
            opt.value = deviceState['Modem SSID'];
            opt.textContent = deviceState['Modem SSID'];
            if (staNetworks.options.length === 1) {
                // only default option, add modem
                staNetworks.appendChild(opt);
            }
            staNetworks.value = deviceState['Modem SSID'];
        }
    }
});

// When clicking the SSID dropdown, trigger scan
staNetworks.addEventListener('click', async () => {
    if (!staHasInternet.checked) return;
    showCenterSpinner();
    try {
        const res = await sendAndWait({ setting: 'device', action: 'read', fields: ['Scan Networks'] }, d => d['Scan Networks'] !== undefined, 10000);
        const sn = res['Scan Networks'];
        staNetworks.innerHTML = '';
        if (Array.isArray(sn)) {
            sn.forEach(item => {
                // server returns array like [ [ssid, rssi, flags], ... ]
                const ssid = Array.isArray(item) ? item[0] : String(item);
                const op = document.createElement('option');
                op.value = ssid;
                op.textContent = `${ssid}`;
                staNetworks.appendChild(op);
            });
        } else if (typeof sn === 'string') {
            // No networks
            hideCenterSpinner();
            staNetworks.innerHTML = '';
            // allow manual typing: replace select with an input
            const manual = document.getElementById('modemSsidManual');
            if (manual) {
                manual.classList.remove('hidden');
            }
            return;
        }
    } catch (err) {
        console.log('Scan failed', err);
    }
    hideCenterSpinner();
});

// Save Station settings
saveSta.addEventListener('click', async () => {
    if (!validateStation()) {
        alert('Station inputs invalid.');
        return;
    }

    showCenterSpinner();
    try {
        const chosen = (staNetworks.value || '').trim();
        const req = { setting: 'device', action: 'write', fields: { 'Modem SSID': chosen, 'Modem Pre-Shared Key': staPass.value.trim() } };
        const resp = await sendAndWait(req, d => d.error === false || d.message !== undefined, 10000);
        deviceState['Modem SSID'] = chosen;
        deviceState['Modem Pre-Shared Key'] = staPass.value.trim();
        console.log('Station saved', resp);
    } catch (err) {
        console.error('Failed to save station', err);
        alert('Failed to save station settings');
        hideCenterSpinner();
        return;
    }
    hideCenterSpinner();
    showStep(4);
});

// Select Mode: enforce rules
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
    // ensure at least one
    if (!modeAp.checked && !modeSta.checked) modeAp.checked = true;
}

modeAp.addEventListener('change', enforceModeRules);
modeSta.addEventListener('change', enforceModeRules);

nextToStep5.addEventListener('click', async () => {
    enforceModeRules();
    showCenterSpinner();
    // show 1s progress then send push-button commands according to selections
    await new Promise(r => setTimeout(r, 1000));
    const fields = {};
    if (modeAp.checked) fields['AP Button'] = true;
    if (modeSta.checked) fields['STA Button'] = true;

    try {
        await sendAndWait({ setting: 'command', action: 'push button', fields }, d => d.message !== undefined || d.error !== undefined, 5000);
    } catch (err) {
        console.log('Push button send error', err);
    }
    hideCenterSpinner();
    showStep(5);

    // request summary values
    try {
        const res = await sendAndWait({ setting: 'device', action: 'read', fields: ['AP SSID','AP Pre-Shared Key','Modem SSID','Modem Pre-Shared Key'] }, d => d['AP SSID'] !== undefined || d['Modem SSID'] !== undefined, 5000);
        if (res['AP SSID']) document.getElementById('summaryAPSSID').textContent = res['AP SSID'];
        if (res['AP Pre-Shared Key']) document.getElementById('summaryAPPsk').textContent = res['AP Pre-Shared Key'];
        if (res['Modem SSID']) document.getElementById('summaryModemSSID').textContent = res['Modem SSID'];
        if (res['Modem Pre-Shared Key']) document.getElementById('summaryModemPsk').textContent = res['Modem Pre-Shared Key'];
        document.getElementById('summaryMode').textContent = `${modeAp.checked ? 'AP' : ''}${modeAp.checked && modeSta.checked ? ' + ' : ''}${modeSta.checked ? 'STA' : ''}`;
    } catch (err) {
        console.log('Could not fetch summary', err);
    }
});

finishBtn.addEventListener('click', async () => {
    showCenterSpinner();
    // show 500ms
    await new Promise(r => setTimeout(r, 500));

    // send selected messages (finalize)
    const fields = {};
    if (modeAp.checked) fields['AP Button'] = true;
    if (modeSta.checked) fields['STA Button'] = true;
    try {
        await sendAndWait({ setting: 'command', action: 'push button', fields }, d => d.message !== undefined || d.error !== undefined, 5000);
    } catch (err) {
        console.log('Finish command error', err);
    }

    // wait 3 seconds to allow device to apply
    await new Promise(r => setTimeout(r, 3000));
    hideCenterSpinner();
    // reload login
    window.location.href = 'index.html';
});

// initial state
showStep(1);

