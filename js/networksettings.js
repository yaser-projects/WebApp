"use strict";
import { connectWebSocket } from "./ws.js";

let ws = null;
let activeSection = "acc-ap";

// Utility toast
function toast(msg, type = "ok") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.className = "toast " + type;
  el.textContent = msg;
  setTimeout(() => (el.className = "toast"), 2000);
}

// Accordion open/close
function setActive(id) {
  document.querySelectorAll(".accItem").forEach((x) => {
    x.classList.toggle("active", x.id === id);
  });
  activeSection = id;
}

function bindAccordion() {
  document.querySelectorAll(".accItem .accHead").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const parent = btn.closest(".accItem");
      if (!parent || parent.id === activeSection) return;
      await saveCurrentSectionIfNeeded();
      setActive(parent.id);
      readCurrentSection();
    });
  });
}

function readCurrentSection() {
  if (!ws?.isConnected) return;
  if (activeSection === "acc-ap") ws.networkApReadAll();
  if (activeSection === "acc-sta") ws.networkStaReadAll();
  if (activeSection === "acc-sec") ws.networkSecurityRead();
}

// Validate
function validateAP() {
  const ssid = document.getElementById("ap-ssid")?.value.trim() || "";
  const key = document.getElementById("ap-preSharedKey")?.value.trim() || "";
  if (!ssid || ssid === "Metal Brain" || ssid.length > 32) return false;
  if (!key || key.length < 8 || key.length > 64) return false;
  return true;
}
function validateSTA() {
  const ssid = document.getElementById("st-ssid")?.value.trim() || "";
  if (!ssid || ssid.length > 32) return false;
  return true;
}
function validateSEC() {
  const u = document.getElementById("sec-username")?.value.trim() || "";
  const p = document.getElementById("sec-password")?.value.trim() || "";
  return !!(u && p);
}

// Write data
function buildApWriteFields() {
  return {
    "AP SSID": document.getElementById("ap-ssid").value.trim(),
    "AP Pre-Shared Key": document.getElementById("ap-preSharedKey").value.trim(),
  };
}
function buildStaWriteFields() {
  return {
    "Modem SSID": document.getElementById("st-ssid").value.trim(),
    "Modem Pre-Shared Key": document.getElementById("st-key").value.trim(),
  };
}
function buildSecWriteFields() {
  return {
    username: document.getElementById("sec-username").value.trim(),
    password: document.getElementById("sec-password").value.trim(),
  };
}

// Save before switch/back
async function saveCurrentSectionIfNeeded() {
  if (!ws?.isConnected) return true;
  if (activeSection === "acc-ap") {
    if (!validateAP()) {
      toast("Fix AP fields first", "bad");
      return false;
    }
    ws.networkApWrite(buildApWriteFields());
    toast("AP Saved");
  }
  if (activeSection === "acc-sta") {
    if (!validateSTA()) {
      toast("Fix STA fields first", "bad");
      return false;
    }
    ws.networkStaWrite(buildStaWriteFields());
    toast("STA Saved");
  }
  if (activeSection === "acc-sec") {
    if (!validateSEC()) {
      toast("Fix Security fields first", "bad");
      return false;
    }
    ws.networkSecurityWrite(buildSecWriteFields());
    toast("Security Saved");
  }
  return true;
}

// Reset factory countdown
function setupReset() {
  const btn = document.getElementById("resetCircle");
  const txt = document.getElementById("resetText");
  if (!btn || !txt) return;

  btn.addEventListener("click", () => {
    let n = 7;
    btn.textContent = n;
    txt.textContent = "Factory reset command";
    const timer = setInterval(() => {
      n--;
      btn.textContent = n;
      if (n === 5)
        ws.sendJSON({
          setting: "command",
          action: "push button",
          fields: { "Reset factory": true },
        });
      if (n <= 0) {
        clearInterval(timer);
        window.location.href = "index.html";
      }
    }, 1000);
  });
}

// Back button
function setupBack() {
  const b = document.getElementById("btnBack");
  if (!b) return;
  b.addEventListener("click", async () => {
    await saveCurrentSectionIfNeeded();
    ws.sendJSON({
      setting: "command",
      action: "push button",
      fields: { Config: true },
    });
    window.location.href = "dashboard.html";
  });
}

// -------------------------
// Helpers for displaying arrays
// -------------------------
function ipv4ToStr(v) {
  return Array.isArray(v) && v.length === 4 ? v.join(".") : "";
}
function macToStr(m) {
  return Array.isArray(m) && m.length === 6
    ? m.map((b) => Number(b).toString(16).padStart(2, "0")).join(":").toUpperCase()
    : "";
}

// -------------------------
// Apply READ results to UI (NO structure change)
// -------------------------
function applyAP(data) {
  if (!data) return;

  const ssid = document.getElementById("ap-ssid");
  const key = document.getElementById("ap-preSharedKey");
  const hidden = document.getElementById("ap-ssidHidden");
  const hostname = document.getElementById("ap-hostname");
  const port = document.getElementById("ap-port");
  const maxConn = document.getElementById("ap-maxConnection");

  const ipv4 = document.getElementById("ap-ipv4");
  const ipv6 = document.getElementById("ap-ipv6"); // اگر دارید (اختیاری)
  const mac = document.getElementById("ap-macaddress"); // اگر دارید (اختیاری)

  const gw = document.getElementById("ap-gateway");
  const subnet = document.getElementById("ap-subnet");
  const dns1 = document.getElementById("ap-dns1");
  const dns2 = document.getElementById("ap-dns2");

  if (ssid) ssid.value = data["AP SSID"] ?? "";
  if (key) key.value = data["AP Pre-Shared Key"] ?? "";
  if (hidden) hidden.checked = !!data["Ssid Hidden"];
  if (hostname) hostname.value = data["AP HostName"] ?? "";
  if (port) port.value = data["AP Port"] ?? "";
  if (maxConn) maxConn.value = data["Max Connection"] ?? "";

  if (ipv4) ipv4.value = ipv4ToStr(data["AP IPv4"]);
  if (gw) gw.value = ipv4ToStr(data["Gateway"]);
  if (subnet) subnet.value = ipv4ToStr(data["Subnet"]);
  if (dns1) dns1.value = ipv4ToStr(data["Primary DNS"]);
  if (dns2) dns2.value = ipv4ToStr(data["Secondary DNS"]);

  // فیلدهای اختیاری (اگر در HTML هست)
  if (mac) mac.value = macToStr(data["AP MAC"]);
  // IPv6 اگر فیلدش را داری و خواستی نمایش بدی، فعلاً خام (می‌تونی بعداً تبدیل کاملش کنیم)
  if (ipv6 && Array.isArray(data["AP IPv6"])) ipv6.value = data["AP IPv6"].join(",");

  toast("AP loaded");
}

function applySTA(data) {
  if (!data) return;

  const ssid = document.getElementById("st-ssid");
  const key = document.getElementById("st-key");
  const hostname = document.getElementById("st-hostname");

  const ip = document.getElementById("st-ip");
  const staMac = document.getElementById("st-macaddress");
  const modemMac = document.getElementById("st-modemmac");

  // Writable fields
  if (ssid) ssid.value = data["Modem SSID"] ?? "";
  if (key) key.value = data["Modem Pre-Shared Key"] ?? "";
  if (hostname) hostname.value = data["STA HostName"] ?? "";

  // Read-only fields
  if (ip && Array.isArray(data["Modem IP"])) ip.value = data["Modem IP"].join(".");
  if (staMac && Array.isArray(data["STA MAC"])) staMac.value = macToStr(data["STA MAC"]);
  if (modemMac && Array.isArray(data["Modem MAC"])) modemMac.value = macToStr(data["Modem MAC"]);

  toast("STA loaded");
}

function applySEC(data) {
  if (!data) return;

  const u = document.getElementById("sec-username");
  const p = document.getElementById("sec-password");

  if (u) u.value = data.username ?? "";
  if (p) p.value = data.password ?? "";

  toast("Security loaded");
}


// Init
window.addEventListener("DOMContentLoaded", () => {
  ws = connectWebSocket({
    onOpen: () => {
      document.getElementById("wsState").textContent = "Connected";
      readCurrentSection();
    },
    onClose: () => (document.getElementById("wsState").textContent = "Disconnected"),
  });

  // ✅ این بخش تنها چیزی بود که کم داشتی:
  // دریافت رویدادهای Read و نشاندن روی UI
  ws.on("net-ap:read", (payload) => applyAP(payload));
  ws.on("net-sta:read", (payload) => applySTA(payload));
  ws.on("net-sec:read", (payload) => applySEC(payload));

  bindAccordion();
  setupBack();
  setupReset();
  setActive("acc-ap");
});
