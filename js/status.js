"use strict";

import { connectWebSocket } from "./ws.js";

// مسیر داشبوردت اگر فرق دارد فقط همین را تغییر بده
const ROUTES = {
  dashboard: "dashboard.html",
};

const el = {
  btnBack: document.getElementById("btnBack"),
  titleClients: document.getElementById("titleClients"),
  tbody: document.getElementById("clientsTbody"),
  readState: document.getElementById("readState"),
};

let ws = null;

function setState(t) {
  el.readState.textContent = t;
}

function setTitle(n) {
  el.titleClients.textContent = `Active DHCP Clients (${n} devices connected)`;
}

function renderEmpty(text = "No clients connected") {
  el.tbody.innerHTML = `
    <tr class="emptyRow">
      <td colspan="4">${text}</td>
    </tr>
  `;
}

function renderRows(clients, hostName) {
  if (!Array.isArray(clients) || clients.length === 0) {
    renderEmpty("No clients connected");
    return;
  }

  const rows = clients.map((c) => {
    const name = c?.[0] ?? "-";
    const ip   = c?.[1] ?? "-";
    const mac  = c?.[2] ?? "-";
    const hn   = hostName ?? "-";
    return `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(ip)}</td>
        <td>${escapeHtml(mac)}</td>
        <td>${escapeHtml(hn)}</td>
      </tr>
    `;
  }).join("");

  el.tbody.innerHTML = rows;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function requestRead() {
  if (!ws?.isConnected) {
    setState("Disconnected");
    return;
  }
  setState("Reading device status...");
  ws.apClientsRead(); // ✅ پیام فقط داخل ws.js
}

document.addEventListener("DOMContentLoaded", () => {
  setTitle(0);
  renderEmpty("Reading...");
  setState("Connecting...");

  el.btnBack.addEventListener("click", () => {
    window.location.href = ROUTES.dashboard;
  });

  ws = connectWebSocket({
    onOpen: () => requestRead(),
    onClose: () => setState("Disconnected"),
    onError: () => setState("Disconnected"),
  });

  // ✅ پاسخ از ws.js به شکل event می‌آید
  window.addEventListener("ap-clients:read", (e) => {
    const stationNum = e?.detail?.stationNum;
    const clients = e?.detail?.clients;
    const hostName = e?.detail?.hostName;

    // اگر Station Num نبود، از طول آرایه استفاده کن
    const n = Number.isFinite(stationNum) ? stationNum : (Array.isArray(clients) ? clients.length : 0);

    setTitle(n);
    renderRows(clients, hostName);
    setState("Updated.");
  });
});
