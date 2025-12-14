/*
  EditDevice.js
  - Reads device id from URL: EditDevice.html?id=<deviceId>
  - Loads devices from localStorage key: mb_devices
  - Updates the selected device and saves back

  NOTE: If your dashboard filename is different, change DASHBOARD_URL below.
*/

(() => {
  'use strict';

  const DASHBOARD_URL = 'dashboard.html';
  const STORAGE_KEY = 'mb_devices';

  const qs = (sel) => document.querySelector(sel);

  const backBtn = qs('#backBtn');
  const form = qs('#editForm');
  const alertBox = qs('#alert');

  const elName = qs('#deviceName');
  const elFreq = qs('#frequency');
  const elMod = qs('#modulation');
  const elBits = qs('#bitCount');
  const elCode = qs('#code');
  const elDelay = qs('#delay');

  const errName = qs('#errName');
  const errFreq = qs('#errFreq');
  const errBits = qs('#errBits');
  const errDelay = qs('#errDelay');

  const url = new URL(window.location.href);
  const deviceId = url.searchParams.get('id');

  function showAlert(msg) {
    alertBox.textContent = msg;
    alertBox.hidden = !msg;
  }

  function safeJsonParse(str, fallback) {
    try { return JSON.parse(str); } catch { return fallback; }
  }

  function loadDevices() {
    return safeJsonParse(localStorage.getItem(STORAGE_KEY) || '[]', []);
  }

  function saveDevices(devices) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  }

  function getDeviceById(devices, id) {
    return devices.find(d => String(d.id) === String(id));
  }

  function setFieldErrors({ name = '', freq = '', bits = '', delay = '' } = {}) {
    errName.textContent = name;
    errFreq.textContent = freq;
    errBits.textContent = bits;
    errDelay.textContent = delay;
  }

  function normalizeNumber(v) {
    const s = String(v ?? '').trim();
    if (!s) return '';
    // allow comma decimal in Persian/European style
    const normalized = s.replace(',', '.');
    return normalized;
  }

  function validate() {
    const name = elName.value.trim();
    const freqStr = normalizeNumber(elFreq.value);
    const bitsStr = normalizeNumber(elBits.value);
    const delayStr = normalizeNumber(elDelay.value);

    const errors = { name: '', freq: '', bits: '', delay: '' };

    if (name.length < 2) errors.name = 'Device Name must be at least 2 characters.';

    if (freqStr) {
      const f = Number(freqStr);
      if (!Number.isFinite(f) || f <= 0) errors.freq = 'Frequency must be a valid positive number.';
    }

    if (bitsStr) {
      const b = Number(bitsStr);
      if (!Number.isFinite(b) || b <= 0 || !Number.isInteger(b)) errors.bits = 'Bit count must be a positive integer.';
    }

    if (delayStr) {
      const d = Number(delayStr);
      if (!Number.isFinite(d) || d < 0) errors.delay = 'Delay must be 0 or a positive number.';
    }

    setFieldErrors(errors);
    const ok = !errors.name && !errors.freq && !errors.bits && !errors.delay;
    return { ok, freqStr, bitsStr, delayStr, name };
  }

  function fillForm(device) {
    elName.value = device?.name ?? '';
    elFreq.value = device?.frequency ?? '';
    elMod.value = device?.modulation ?? 'OOK';
    elBits.value = device?.bitCount ?? '';
    elCode.value = device?.code ?? '';
    elDelay.value = device?.delay ?? '';
  }

  function init() {
    backBtn.addEventListener('click', () => {
      window.location.href = DASHBOARD_URL;
    });

    // Live validation (lightweight)
    ['input', 'change'].forEach(evt => {
      form.addEventListener(evt, () => {
        validate();
      });
    });

    const devices = loadDevices();

    if (!deviceId) {
      showAlert('No device id provided. Open this page as: EditDevice.html?id=<deviceId>');
      form.querySelectorAll('input,select,button').forEach(el => {
        if (el.id !== 'backBtn') el.disabled = true;
      });
      return;
    }

    const device = getDeviceById(devices, deviceId);
    if (!device) {
      showAlert(`Device not found for id: ${deviceId}`);
      form.querySelectorAll('input,select,button').forEach(el => {
        if (el.id !== 'backBtn') el.disabled = true;
      });
      return;
    }

    fillForm(device);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      showAlert('');

      const { ok, freqStr, bitsStr, delayStr, name } = validate();
      if (!ok) return;

      const updated = {
        ...device,
        name,
        frequency: freqStr,
        modulation: elMod.value,
        bitCount: bitsStr,
        code: elCode.value.trim(),
        delay: delayStr,
      };

      const nextDevices = devices.map(d => (String(d.id) === String(deviceId) ? updated : d));
      saveDevices(nextDevices);

      // Return to dashboard after saving
      window.location.href = DASHBOARD_URL;
    });
  }

  init();
})();
