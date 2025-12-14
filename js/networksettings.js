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

// Init
window.addEventListener("DOMContentLoaded", () => {
  ws = connectWebSocket({
    onOpen: () => {
      document.getElementById("wsState").textContent = "Connected";
      readCurrentSection();
    },
    onClose: () => (document.getElementById("wsState").textContent = "Disconnected"),
  });
  bindAccordion();
  setupBack();
  setupReset();
  setActive("acc-ap");
});
