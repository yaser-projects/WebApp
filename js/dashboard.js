"use strict";

/**
 * Dashboard list data (local demo).
 * Replace this later with real data source (WebSocket, API, etc.).
 */

const STORE_KEY = "dashboard_objects_v1";

// Change this to your real devices page filename if different:
const DEVICES_PAGE = "addDevice.html";

// ✅ Device control page (open when user clicks an object)
const DEVICE_CONTROL_PAGE = "deviceControl.html";

// ✅ Selected object (so deviceControl.html can read it)
const SELECTED_OBJECT_KEY = "dashboard_selected_object_v1";

// ✅ Long-press to show Edit/Delete actions
const LONG_PRESS_MS = 1500; // 1.5s
// Change this to your real edit page filename if different:
const EDIT_PAGE = "editDevice.html";

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


// ===== Long-press Action Mode (Edit / Delete) =====
let actionMode = false;
let selectedItemId = null;
let suppressNextClick = false;

// Cache original header button SVGs to restore later
let _origSearchBtnHTML = null;
let _origDevicesBtnHTML = null;

function svgTrash() {
  return `
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M4 7h16"></path>
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
    <path d="M7 7l1 14h8l1-14"></path>
    <path d="M10 11v6"></path>
    <path d="M14 11v6"></path>
  </svg>`;
}

function svgEdit() {
  return `
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M12 20h9"></path>
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5"></path>
  </svg>`;
}

function setTopActionsMode(on) {
  const btnSearch = document.getElementById("btnSearch");
  const btnDevices = document.getElementById("btnDevices");
  if (!btnSearch || !btnDevices) return;

  // Remember original markup once
  if (_origSearchBtnHTML === null) _origSearchBtnHTML = btnSearch.innerHTML;
  if (_origDevicesBtnHTML === null) _origDevicesBtnHTML = btnDevices.innerHTML;

  if (on) {
    btnSearch.innerHTML = svgTrash();
    btnSearch.title = "Delete";
    btnSearch.setAttribute("aria-label", "Delete");

    btnDevices.innerHTML = svgEdit();
    btnDevices.title = "Edit";
    btnDevices.setAttribute("aria-label", "Edit");
  } else {
    btnSearch.innerHTML = _origSearchBtnHTML;
    btnSearch.title = "Search";
    btnSearch.setAttribute("aria-label", "Search");

    btnDevices.innerHTML = _origDevicesBtnHTML;
    btnDevices.title = "Add Devices";
    btnDevices.setAttribute("aria-label", "Devices");
  }
}

function enterActionMode(itemId) {
  actionMode = true;
  selectedItemId = itemId;
  setTopActionsMode(true);
}

function exitActionMode() {
  actionMode = false;
  selectedItemId = null;
  setTopActionsMode(false);
}

// Remove item by id from localStorage
function deleteItemById(id) {
  const list = loadItems();
  const next = list.filter(x => x.id !== id);
  saveItems(next);
  return next;
}

// ===== /Long-press Action Mode =====

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
    el.className = "item" + ((actionMode && selectedItemId === item.id) ? " selected" : "");
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

    el.addEventListener("click", (ev) => {
      // If long-press just fired, ignore the following click
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }

      // If we are in action mode, normal tap just changes selection (no navigation)
      if (actionMode) {
        selectedItemId = item.id;
        render(loadItems());
        return;
      }

      // Normal behavior: open Device Control
      try { localStorage.setItem(SELECTED_OBJECT_KEY, JSON.stringify(item)); } catch {}
      const id = encodeURIComponent(item.id || "");
      window.location.href = `${DEVICE_CONTROL_PAGE}${id ? `?id=${id}` : ""}`;
    });

    // Long-press (mouse or touch) => enter action mode
    let pressTimer = null;
    let startX = 0, startY = 0;
    const MOVE_TOLERANCE = 10; // px

    const clearPressTimer = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    el.addEventListener("pointerdown", (ev) => {
      // Only primary button for mouse
      if (ev.pointerType === "mouse" && ev.button !== 0) return;

      startX = ev.clientX;
      startY = ev.clientY;

      clearPressTimer();
      pressTimer = setTimeout(() => {
        suppressNextClick = true; // prevent click navigation after long-press
        enterActionMode(item.id);
        render(loadItems());
        // small haptic-like feedback (visual only)
        el.classList.add("selected");
      }, LONG_PRESS_MS);
    });

    el.addEventListener("pointerup", clearPressTimer);
    el.addEventListener("pointercancel", clearPressTimer);
    el.addEventListener("pointerleave", clearPressTimer);
    el.addEventListener("pointermove", (ev) => {
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) clearPressTimer();
    });
container.appendChild(el);
  }
}

function setConnectionStatus(isConnected) {
  // NOTE: IDs in HTML are: dashboardStatusText + dashboardDot
  const text = document.getElementById("dashboardStatusText");
  const dot = document.getElementById("dashboardDot");

  // If markup changes or elements are missing, don't crash the whole dashboard.
  if (!text || !dot) return;

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

  // Tap outside the list to exit action mode
  document.addEventListener("click", (e) => {
    if (!actionMode) return;
    const listEl = document.getElementById("list");
    const pillEl = document.querySelector(".pill");
    const t = e.target;
    const insideList = listEl && listEl.contains(t);
    const insidePill = pillEl && pillEl.contains(t);
    if (!insideList && !insidePill) {
      exitActionMode();
      render(loadItems());
    }
  });

document.getElementById("btnSearch").addEventListener("click", () => {
  // If long-press action mode is active => Delete selected object
  if (actionMode) {
    if (!selectedItemId) return;
    const list = loadItems();
    const target = list.find(x => x.id === selectedItemId);
    const label = target?.name ? `“${target.name}”` : "this object";
    const ok = confirm(`Delete ${label}?`);
    if (!ok) return;

    const next = deleteItemById(selectedItemId);
    exitActionMode();
    render(next);
    return;
  }

  // Normal mode => Search toggle
  if (searchCtl.isOpen()) searchCtl.close();
  else searchCtl.open();
});

document.getElementById("btnDevices").addEventListener("click", () => {
  // If long-press action mode is active => Edit selected object
  if (actionMode) {
    if (!selectedItemId) return;
    const list = loadItems();
    const target = list.find(x => x.id === selectedItemId);
    if (target) {
      try { localStorage.setItem(SELECTED_OBJECT_KEY, JSON.stringify(target)); } catch {}
    }
    const id = encodeURIComponent(selectedItemId || "");
    window.location.href = `${EDIT_PAGE}${id ? `?id=${id}` : ""}`;
    return;
  }

  // Normal mode => Add Devices page
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