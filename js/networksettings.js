"use strict";

// NOTE: networksettings.js lives in /js and ws.js is also in /js.
// The old path "./JS/ws.js" breaks on case-sensitive systems and prevents
// the whole page (accordion/back button) from working.
import { connectWebSocket } from "./ws.js";

/* ---------------------------
   helpers: format/parse
----------------------------*/
function showToast(msg, kind = "") {
  const el = document.getElementById("toast");
  el.className = `toast ${kind}`.trim();
  el.textContent = msg || "";
  if (msg) setTimeout(() => { el.textContent = ""; el.className = "toast"; }, 1800);
}

function setWSState(connected) {
  const s = document.getElementById("wsState");
  s.textContent = connected ? "Connected" : "Disconnected";
}

function formatMAC(arr) {
  if (!Array.isArray(arr) || arr.length !== 6) return "";
  return arr.map(n => Number(n).toString(16).padStart(2, "0").toUpperCase()).join(":");
}

function formatIPv4(arr) {
  if (!Array.isArray(arr) || arr.length !== 4) return "";
  return arr.map(n => String(Number(n))).join(".");
}

function parseIPv4(str) {
  const s = String(str || "").trim();
  const parts = s.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(p => {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    return n;
  });
  return nums.includes(null) ? null : nums;
}

function formatIPv6(bytes16) {
  if (!Array.isArray(bytes16) || bytes16.length !== 16) return "";
  const parts = [];
  for (let i = 0; i < 16; i += 2) {
    const val = ((Number(bytes16[i]) & 0xFF) << 8) | (Number(bytes16[i + 1]) & 0xFF);
    parts.push(val.toString(16).padStart(4, "0"));
  }
  return parts.join(":");
}

function parseIPv6(str) {
  const s = String(str || "").trim();
  const parts = s.split(":");
  if (parts.length !== 8) return null;

  const bytes = [];
  for (const part of parts) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return null;
    const num = parseInt(part, 16);
    bytes.push((num >> 8) & 0xFF, num & 0xFF);
  }
  return bytes;
}

function parsePort(str) {
  const s = String(str || "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0 || n > 65535) return null;
  return n;
}

/* ---------------------------
   validation UI
----------------------------*/
function setErr(fieldId, msg) {
  const wrap = document.querySelector(`.inputIcon[data-field="${fieldId}"]`);
  const err = document.getElementById(`${fieldId}-err`);
  if (wrap) wrap.classList.toggle("error", !!msg);
  if (err) err.textContent = msg || "";
}

function clearErr(fieldId) {
  setErr(fieldId, "");
}

function isIPv4CharsKey(e) {
  return /[0-9.]/.test(e.key) || ["Backspace","Tab","ArrowLeft","ArrowRight","Delete","Home","End"].includes(e.key);
}
function isIPv6CharsKey(e) {
  return /[0-9a-fA-F:]/.test(e.key) || ["Backspace","Tab","ArrowLeft","ArrowRight","Delete","Home","End"].includes(e.key);
}
function isDigitsKey(e) {
  return /[0-9]/.test(e.key) || ["Backspace","Tab","ArrowLeft","ArrowRight","Delete","Home","End"].includes(e.key);
}

/* ---------------------------
   state + dirty tracking
----------------------------*/
let ws = null;

let openId = "acc-ap"; // default open
let dirtyAP = false;
let dirtySTA = false;
let dirtySEC = false;

let lastAP = null;
let lastSTA = null;
let lastSEC = null;

function markDirty(section) {
  if (section === "ap") dirtyAP = true;
  if (section === "sta") dirtySTA = true;
  if (section === "sec") dirtySEC = true;
}

/* ---------------------------
   accordion
----------------------------*/
function setActiveAccordion(id) {
  const items = document.querySelectorAll(".accItem");
  items.forEach(x => x.classList.toggle("active", x.id === id));
  openId = id;
}

function bindAccordion() {
  document.querySelectorAll(".accItem .accHead").forEach(btn => {
    btn.addEventListener("click", async () => {
      const parent = btn.closest(".accItem");
      if (!parent) return;
      if (parent.id === openId) return; // always keep one open

      // before switching, try save previous section if needed
      const ok = await saveCurrentSectionIfNeeded();
      if (!ok) return;

      setActiveAccordion(parent.id);
      requestReadForCurrent();
    });
  });
}

/* ---------------------------
   READ requests
----------------------------*/
function requestReadForCurrent() {
  if (!ws?.isConnected) return;

  if (openId === "acc-ap") ws.networkApReadAll();
  if (openId === "acc-sta") ws.networkStaReadAll();
  if (openId === "acc-sec") ws.networkSecurityRead();
  // reset has no read
}

/* ---------------------------
   AP validate + build payload
----------------------------*/
function apIsIPv4Mode() {
  return document.getElementById("ap-ipmode4").checked;
}

function validateAP() {
  let ok = true;

  const ssid = document.getElementById("ap-ssid").value.trim();
  if (!ssid) { setErr("ap-ssid", "SSID is required."); ok = false; }
  else if (ssid.length > 32) { setErr("ap-ssid", "SSID must be 32 characters or fewer."); ok = false; }
  else if (ssid === "Metal Brain") { setErr("ap-ssid", 'SSID cannot be "Metal Brain".'); ok = false; }
  else clearErr("ap-ssid");

  const key = document.getElementById("ap-preSharedKey").value.trim();
  if (!key) { setErr("ap-preSharedKey", "Pre-Shared Key is required."); ok = false; }
  else if (key.length < 8 || key.length > 64) { setErr("ap-preSharedKey", "Password must be 8 to 64 characters."); ok = false; }
  else clearErr("ap-preSharedKey");

  const hostname = document.getElementById("ap-hostname").value.trim();
  if (!hostname) { setErr("ap-hostname", "Hostname is required."); ok = false; }
  else if (hostname.length > 16) { setErr("ap-hostname", "Hostname must be 16 characters or fewer."); ok = false; }
  else clearErr("ap-hostname");

  const port = parsePort(document.getElementById("ap-port").value);
  if (port === null) { setErr("ap-port", "Port must be 0 to 65535."); ok = false; }
  else clearErr("ap-port");

  // IP mode validation
  const ipv4Str = document.getElementById("ap-ipv4").value.trim();
  const ipv6Str = document.getElementById("ap-ipv6").value.trim();

  if (apIsIPv4Mode()) {
    const ipv4 = parseIPv4(ipv4Str);
    if (!ipv4) { setErr("ap-ipv4", "IPv4 must be 4 numbers 0-255."); ok = false; }
    else clearErr("ap-ipv4");
    clearErr("ap-ipv6"); // ignore ipv6 when disabled
  } else {
    const ipv6 = parseIPv6(ipv6Str);
    if (!ipv6) { setErr("ap-ipv6", "IPv6 must be exactly 8 hex segments."); ok = false; }
    else clearErr("ap-ipv6");
    clearErr("ap-ipv4"); // ignore ipv4 when disabled
  }

  // Always-required IPv4 fields (gateway/subnet/dns)
  const gw = parseIPv4(document.getElementById("ap-gateway").value);
  if (!gw) { setErr("ap-gateway", "Gateway must be IPv4 (0-255)."); ok = false; } else clearErr("ap-gateway");

  const sn = parseIPv4(document.getElementById("ap-subnet").value);
  if (!sn) { setErr("ap-subnet", "Subnet must be IPv4 (0-255)."); ok = false; } else clearErr("ap-subnet");

  const d1 = parseIPv4(document.getElementById("ap-dns1").value);
  if (!d1) { setErr("ap-dns1", "Primary DNS must be IPv4 (0-255)."); ok = false; } else clearErr("ap-dns1");

  const d2 = parseIPv4(document.getElementById("ap-dns2").value);
  if (!d2) { setErr("ap-dns2", "Secondary DNS must be IPv4 (0-255)."); ok = false; } else clearErr("ap-dns2");

  return ok;
}

function buildApWriteFields() {
  const ssid = document.getElementById("ap-ssid").value.trim();
  const key = document.getElementById("ap-preSharedKey").value.trim();
  const hidden = document.getElementById("ap-ssidHidden").checked;
  const hostname = document.getElementById("ap-hostname").value.trim();
  const port = parsePort(document.getElementById("ap-port").value);
  const wifiChannel = document.getElementById("ap-wifiChannel").value;
  const maxConn = document.getElementById("ap-maxConnection").value;

  const fields = {
    "AP SSID": ssid,
    "AP Pre-Shared Key": key,
    "Ssid Hidden": hidden,
    "AP HostName": hostname,
    "AP Port": port,
    "Wifi Channel": wifiChannel,
    "Max Connection": maxConn,
    "Gateway": parseIPv4(document.getElementById("ap-gateway").value),
    "Subnet": parseIPv4(document.getElementById("ap-subnet").value),
    "Primary DNS": parseIPv4(document.getElementById("ap-dns1").value),
    "Secondary DNS": parseIPv4(document.getElementById("ap-dns2").value),
  };

  if (apIsIPv4Mode()) fields["AP IPv4"] = parseIPv4(document.getElementById("ap-ipv4").value);
  else fields["AP IPv6"] = parseIPv6(document.getElementById("ap-ipv6").value);

  return fields;
}

/* ---------------------------
   STA validate + payload
----------------------------*/
function validateSTA() {
  let ok = true;

  const ssid = document.getElementById("st-ssid").value.trim();
  if (!ssid) { setErr("st-ssid", "SSID is required."); ok = false; }
  else if (ssid.length > 32) { setErr("st-ssid", "SSID must be 32 characters or fewer."); ok = false; }
  else clearErr("st-ssid");

  const key = document.getElementById("st-key").value.trim();
  if (key.length > 64) { setErr("st-key", "Key must be 0 to 64 characters."); ok = false; }
  else clearErr("st-key");

  const hn = document.getElementById("st-hostname").value.trim();
  if (!hn) { setErr("st-hostname", "Host Name is required."); ok = false; }
  else if (hn.length > 16) { setErr("st-hostname", "Host Name must be 16 characters or fewer."); ok = false; }
  else clearErr("st-hostname");

  return ok;
}

function buildStaWriteFields() {
  return {
    "Modem SSID": document.getElementById("st-ssid").value.trim(),
    "Modem Pre-Shared Key": document.getElementById("st-key").value.trim(),
    "STA HostName": document.getElementById("st-hostname").value.trim(),
  };
}

/* ---------------------------
   SEC validate + payload
----------------------------*/
function validateSEC() {
  let ok = true;

  const u = document.getElementById("sec-username").value.trim();
  if (!u) { setErr("sec-username", "Username is required."); ok = false; }
  else if (u.length > 16) { setErr("sec-username", "Username must be 16 characters or fewer."); ok = false; }
  else clearErr("sec-username");

  const p = document.getElementById("sec-password").value.trim();
  if (!p) { setErr("sec-password", "Password is required."); ok = false; }
  else if (p.length > 16) { setErr("sec-password", "Password must be 16 characters or fewer."); ok = false; }
  else clearErr("sec-password");

  return ok;
}

function buildSecWriteFields() {
  return {
    username: document.getElementById("sec-username").value.trim(),
    password: document.getElementById("sec-password").value.trim(),
  };
}

/* ---------------------------
   save current section (on switch/back)
----------------------------*/
async function saveCurrentSectionIfNeeded() {
  if (!ws?.isConnected) return true;

  if (openId === "acc-ap" && dirtyAP) {
    if (!validateAP()) { showToast("Fix Access Point errors first.", "bad"); return false; }
    ws.networkApWrite(buildApWriteFields());
    dirtyAP = false;
    showToast("AP settings sent.", "ok");
  }

  if (openId === "acc-sta" && dirtySTA) {
    if (!validateSTA()) { showToast("Fix Station errors first.", "bad"); return false; }
    ws.networkStaWrite(buildStaWriteFields());
    dirtySTA = false;
    showToast("Station settings sent.", "ok");
  }

  if (openId === "acc-sec" && dirtySEC) {
    if (!validateSEC()) { showToast("Fix Security errors first.", "bad"); return false; }
    ws.networkSecurityWrite(buildSecWriteFields());
    dirtySEC = false;
    showToast("Security settings sent.", "ok");
  }

  return true;
}

/* ---------------------------
   reset factory countdown
   - 7 -> 0
   - send Reset at 5
   - redirect to index.html at 0
----------------------------*/
function setupReset() {
  const btn = document.getElementById("resetCircle");
  const ring = document.querySelector(".ringBar");
  const main = document.getElementById("resetMain");
  const sub = document.getElementById("resetSub");
  const txt = document.getElementById("resetText");

  const total = 314;
  let running = false;
  let t = null;
  let n = 7;
  let sentAt5 = false;

  function paint() {
    const progress = n / 7;
    ring.style.strokeDashoffset = String(total * (1 - progress));
  }

  function resetUI() {
    ring.style.strokeDashoffset = "0";
    main.textContent = "Start";
    sub.textContent = "Press to factory reset";
    txt.textContent = "Press to factory reset";
    running = false;
    sentAt5 = false;
    n = 7;
  }

  resetUI();

  btn.addEventListener("click", () => {
    if (running) return;
    if (!ws?.isConnected) { showToast("WebSocket disconnected.", "bad"); return; }

    running = true;
    n = 7;
    sentAt5 = false;
    main.textContent = String(n);
    sub.textContent = "Reset countdown";
    txt.textContent = "Factory reset command";
    paint();

    t = setInterval(() => {
      n -= 1;
      main.textContent = String(n);
      paint();

      // send at 5
      if (!sentAt5 && n === 5) {
        sentAt5 = true;
        ws.resetFactoryCommand();
        showToast("Reset factory sent.", "ok");
      }

      if (n <= 0) {
        clearInterval(t);
        t = null;

        // after countdown finished -> go login
        setTimeout(() => {
          window.location.href = "index.html";
        }, 600);

        resetUI();
      }
    }, 1000);
  });
}

/* ---------------------------
   input bindings (live validation + dirty)
----------------------------*/
function bindInputs() {
  // AP dirty
  ["ap-ssid","ap-preSharedKey","ap-hostname","ap-ipv4","ap-ipv6","ap-port","ap-gateway","ap-subnet","ap-dns1","ap-dns2","ap-wifiChannel","ap-maxConnection"]
    .forEach(id => document.getElementById(id).addEventListener("input", () => markDirty("ap")));
  document.getElementById("ap-ssidHidden").addEventListener("change", () => markDirty("ap"));
  document.getElementById("ap-wifiChannel").addEventListener("change", () => markDirty("ap"));
  document.getElementById("ap-maxConnection").addEventListener("change", () => markDirty("ap"));

  // Station dirty
  ["st-ssid","st-key","st-hostname"].forEach(id => document.getElementById(id).addEventListener("input", () => markDirty("sta")));

  // Security dirty
  ["sec-username","sec-password"].forEach(id => document.getElementById(id).addEventListener("input", () => markDirty("sec")));

  // key filters
  ["ap-ipv4","ap-gateway","ap-subnet","ap-dns1","ap-dns2"].forEach(id => {
    document.getElementById(id).addEventListener("keydown", (e) => { if (!isIPv4CharsKey(e)) e.preventDefault(); });
  });
  document.getElementById("ap-ipv6").addEventListener("keydown", (e) => { if (!isIPv6CharsKey(e)) e.preventDefault(); });
  document.getElementById("ap-port").addEventListener("keydown", (e) => { if (!isDigitsKey(e)) e.preventDefault(); });

  // live validation
  document.getElementById("ap-ssid").addEventListener("input", validateAP);
  document.getElementById("ap-preSharedKey").addEventListener("input", validateAP);
  document.getElementById("ap-hostname").addEventListener("input", validateAP);
  document.getElementById("ap-ipv4").addEventListener("input", validateAP);
  document.getElementById("ap-ipv6").addEventListener("input", validateAP);
  document.getElementById("ap-port").addEventListener("input", validateAP);
  ["ap-gateway","ap-subnet","ap-dns1","ap-dns2"].forEach(id => document.getElementById(id).addEventListener("input", validateAP));

  document.getElementById("st-ssid").addEventListener("input", validateSTA);
  document.getElementById("st-key").addEventListener("input", validateSTA);
  document.getElementById("st-hostname").addEventListener("input", validateSTA);

  document.getElementById("sec-username").addEventListener("input", validateSEC);
  document.getElementById("sec-password").addEventListener("input", validateSEC);

  // IP mode switch
  const r4 = document.getElementById("ap-ipmode4");
  const r6 = document.getElementById("ap-ipmode6");
  const v4 = document.getElementById("ap-ipv4");
  const v6 = document.getElementById("ap-ipv6");

  function toggleIP() {
    if (r4.checked) {
      v4.disabled = false;
      v6.disabled = true;
      v6.value = "";
      clearErr("ap-ipv6");
    } else {
      v6.disabled = false;
      v4.disabled = true;
      v4.value = "";
      clearErr("ap-ipv4");
    }
    markDirty("ap");
    validateAP();
  }
  r4.addEventListener("change", toggleIP);
  r6.addEventListener("change", toggleIP);
  toggleIP();
}

/* ---------------------------
   fill UI from WS events
----------------------------*/
function bindWSEvents() {
  window.addEventListener("ws-status", (e) => {
    setWSState(!!e.detail?.connected);
  });

  window.addEventListener("net-ap:read", (e) => {
    const d = e.detail?.raw || {};
    lastAP = d;

    if (typeof d["AP SSID"] === "string") document.getElementById("ap-ssid").value = d["AP SSID"];
    if (typeof d["AP Pre-Shared Key"] === "string") document.getElementById("ap-preSharedKey").value = d["AP Pre-Shared Key"];

    if (d["Ssid Hidden"] !== undefined) document.getElementById("ap-ssidHidden").checked = !!d["Ssid Hidden"];

    if (typeof d["AP HostName"] === "string") document.getElementById("ap-hostname").value = d["AP HostName"];
    if (typeof d["AP Port"] === "number") document.getElementById("ap-port").value = String(d["AP Port"]);

    // channel: allow Auto
    if (d["Wifi Channel"] !== undefined) {
      const v = String(d["Wifi Channel"]);
      document.getElementById("ap-wifiChannel").value = (v === "0" || v.toLowerCase() === "auto") ? "Auto" : v;
    }

    if (d["Max Connection"] !== undefined) document.getElementById("ap-maxConnection").value = String(d["Max Connection"]);

    if (Array.isArray(d["AP MAC"])) document.getElementById("ap-macaddress").value = formatMAC(d["AP MAC"]);

    // IPs
    if (Array.isArray(d["AP IPv4"])) {
      document.getElementById("ap-ipmode4").checked = true;
      document.getElementById("ap-ipv4").value = formatIPv4(d["AP IPv4"]);
    }
    if (Array.isArray(d["AP IPv6"])) {
      document.getElementById("ap-ipmode6").checked = true;
      document.getElementById("ap-ipv6").value = formatIPv6(d["AP IPv6"]);
    }
    // network
    if (Array.isArray(d["Gateway"])) document.getElementById("ap-gateway").value = formatIPv4(d["Gateway"]);
    if (Array.isArray(d["Subnet"])) document.getElementById("ap-subnet").value = formatIPv4(d["Subnet"]);
    if (Array.isArray(d["Primary DNS"])) document.getElementById("ap-dns1").value = formatIPv4(d["Primary DNS"]);
    if (Array.isArray(d["Secondary DNS"])) document.getElementById("ap-dns2").value = formatIPv4(d["Secondary DNS"]);

    dirtyAP = false;
    validateAP();
  });

  window.addEventListener("net-sta:read", (e) => {
    const d = e.detail?.raw || {};
    lastSTA = d;

    if (typeof d["Modem SSID"] === "string") document.getElementById("st-ssid").value = d["Modem SSID"];
    if (typeof d["Modem Pre-Shared Key"] === "string") document.getElementById("st-key").value = d["Modem Pre-Shared Key"];
    if (typeof d["STA HostName"] === "string") document.getElementById("st-hostname").value = d["STA HostName"];

    if (Array.isArray(d["Modem IP"])) document.getElementById("st-ip").value = formatIPv4(d["Modem IP"]);
    if (Array.isArray(d["STA MAC"])) document.getElementById("st-macaddress").value = formatMAC(d["STA MAC"]);
    if (Array.isArray(d["Modem MAC"])) document.getElementById("st-modemmac").value = formatMAC(d["Modem MAC"]);

    dirtySTA = false;
    validateSTA();
  });

  window.addEventListener("net-sec:read", (e) => {
    const d = e.detail?.raw || {};
    lastSEC = d;

    if (typeof d["username"] === "string") document.getElementById("sec-username").value = d["username"];
    if (typeof d["password"] === "string") document.getElementById("sec-password").value = d["password"];

    dirtySEC = false;
    validateSEC();
  });

  window.addEventListener("device:settings:saved", () => {
    showToast("Device settings saved.", "ok");
  });

  window.addEventListener("device:settings:error", (e) => {
    const msg = e.detail?.message || "Error";
    showToast(msg, "bad");
  });
}

/* ---------------------------
   back button rule:
   1) write active section (if dirty + valid)
   2) then send Config command
   3) then go dashboard
----------------------------*/
function setupBack() {
  document.getElementById("btnBack").addEventListener("click", async () => {
    const ok = await saveCurrentSectionIfNeeded();
    if (!ok) return;

    if (ws?.isConnected) ws.pushButtonConfig();
    // Dashboard page in this project is userInterface.html
    window.location.href = "userInterface.html";
  });
}

/* ---------------------------
   init
----------------------------*/
window.addEventListener("DOMContentLoaded", () => {
  // default open AP
  setActiveAccordion("acc-ap");
  bindAccordion();
  bindInputs();
  bindWSEvents();
  setupReset();
  setupBack();

  ws = connectWebSocket({
    onOpen: () => {
      setWSState(true);
      requestReadForCurrent(); // Access Point read on first load
    },
    onClose: () => setWSState(false),
    onError: () => setWSState(false),
  });
});
