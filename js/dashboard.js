"use strict";

/**
 * User Interface list data (local demo).
 * Replace this later with real data source (WebSocket, API, etc.).
 */

const STORE_KEY = "dashboard_objects_v1";

// Change this to your real devices page filename if different:
const DEVICES_PAGE = "addDevice.html";

// ✅ Bottom navigation routes (change filenames here if yours differ)
const ROUTES = {
  about: "about.html",
  status: "status.html",
  network: "networksettings.html"
};


function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  const i = parts.map(p => (p[0] || "").toUpperCase()).join("");
  return i || "O";
}

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function loadItems() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); }
  catch { return []; }
}

function saveItems(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

function seedIfEmpty() {
  const existing = loadItems();
  if (existing.length) return;

  const demo = [
    { id: crypto.randomUUID(), name: "Remote Scan", sub: "Last hit: 433.92 MHz • 24-bit", time: nowTime(), state: "good", tag: "Ready" },
    { id: crypto.randomUUID(), name: "Gate Controller", sub: "Last hit: 315.00 MHz • EV1527", time: nowTime(), state: "warn", tag: "New" },
    { id: crypto.randomUUID(), name: "AC Remote", sub: "No activity yet", time: nowTime(), state: "bad", tag: "Offline" }
  ];

  saveItems(demo);
}

function tagClass(state) {
  if (state === "good") return "good";
  if (state === "warn") return "warn";
  if (state === "bad") return "bad";
  return "";
}

function render(list) {
  const container = document.getElementById("list");
  const countBadge = document.getElementById("countBadge");
  const emptyState = document.getElementById("emptyState");

  countBadge.textContent = String(list.length);
  container.innerHTML = "";

  if (!list.length) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  for (const item of list) {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="avatar">${escapeHtml(initials(item.name))}</div>
      <div class="meta">
        <div class="name">${escapeHtml(item.name || "Unnamed Object")}</div>
        <div class="sub">${escapeHtml(item.sub || "")}</div>
      </div>
      <div class="right">
        <div class="time">${escapeHtml(item.time || "")}</div>
        <div class="tags">
          <span class="tag ${tagClass(item.state)}">${escapeHtml(item.tag || "Object")}</span>
        </div>
      </div>
    `;

    el.addEventListener("click", () => {
      // Placeholder: open object details later
      alert(`Object: ${item.name}`);
    });

    container.appendChild(el);
  }
}

function setConnectionStatus(isConnected) {
  const text = document.getElementById("dashboardStatusText");
  const dot = document.getElementById("dashboardDot");

  if (isConnected) {
    text.textContent = "Ready";
    dot.classList.add("good");
  } else {
    text.textContent = "Disconnected";
    dot.classList.remove("good");
  }
}

function setupSearch(allItems) {
  const searchRow = document.getElementById("searchRow");
  const searchInput = document.getElementById("searchInput");
  const btnClear = document.getElementById("btnClear");

  const apply = () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) return render(allItems);

    const filtered = allItems.filter(x =>
      (x.name || "").toLowerCase().includes(q) ||
      (x.sub || "").toLowerCase().includes(q) ||
      (x.tag || "").toLowerCase().includes(q)
    );
    render(filtered);
  };

  searchInput.addEventListener("input", apply);

  btnClear.addEventListener("click", () => {
    searchInput.value = "";
    render(allItems);
    searchInput.focus();
  });

  return {
    open() {
      searchRow.classList.add("show");
      searchRow.setAttribute("aria-hidden", "false");
      searchInput.focus();
    },
    close() {
      searchRow.classList.remove("show");
      searchRow.setAttribute("aria-hidden", "true");
      searchInput.value = "";
      render(allItems);
    },
    isOpen() {
      return searchRow.classList.contains("show");
    }
  };
}

function main() {
  seedIfEmpty();

  // Demo status: disconnected by default
  setConnectionStatus(false);

  const allItems = loadItems();
  render(allItems);

  const searchCtl = setupSearch(allItems);

document.getElementById("btnSearch").addEventListener("click", () => {
  if (searchCtl.isOpen()) searchCtl.close();
  else searchCtl.open();
});

document.getElementById("btnDevices").addEventListener("click", () => {
  window.location.href = DEVICES_PAGE;
});

  // ✅ Bottom nav buttons
document.getElementById("btnNavAbout")?.addEventListener("click", () => {
  window.location.href = ROUTES.about;
});

document.getElementById("btnNavStatus")?.addEventListener("click", () => {
  window.location.href = ROUTES.status;
});

document.getElementById("btnNavNetwork")?.addEventListener("click", () => {
  window.location.href = ROUTES.network;
});
}

document.addEventListener("DOMContentLoaded", main);
