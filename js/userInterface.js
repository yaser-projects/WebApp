const STORE_KEY = "mb_devices_v1";

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function seedIfEmpty() {
  const existing = loadDevices();
  if (existing.length) return;

  const demo = [
    { id: crypto.randomUUID(), name: "Remote - Living Room", last: "Last hit: 433.92 MHz • 24-bit", time: nowTime(), state: "good", tag: "Ready" },
    { id: crypto.randomUUID(), name: "Gate Controller", last: "Last hit: 315.00 MHz • EV1527", time: nowTime(), state: "warn", tag: "New" },
    { id: crypto.randomUUID(), name: "AC Remote", last: "Last hit: 868.30 MHz • RAW", time: nowTime(), state: "bad", tag: "Offline" },
  ];
  localStorage.setItem(STORE_KEY, JSON.stringify(demo));
}

function loadDevices() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveDevices(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  const i = parts.map(p => p[0]?.toUpperCase()).join("");
  return i || "R";
}

function badgeClass(state) {
  if (state === "good") return "good";
  if (state === "warn") return "warn";
  if (state === "bad") return "bad";
  return "";
}

function render(list) {
  const container = document.getElementById("list");
  const count = document.getElementById("countBadge");
  const empty = document.getElementById("emptyState");

  count.textContent = `${list.length} remotes`;

  container.innerHTML = "";
  if (!list.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  list.forEach(item => {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="avatar">${initials(item.name)}</div>
      <div class="meta">
        <div class="name">${escapeHtml(item.name || "Unnamed Remote")}</div>
        <div class="sub">${escapeHtml(item.last || "No activity yet")}</div>
      </div>
      <div class="right">
        <div class="time">${escapeHtml(item.time || "")}</div>
        <div class="badges">
          <span class="badge ${badgeClass(item.state)}">${escapeHtml(item.tag || "Device")}</span>
        </div>
      </div>
    `;

    // Placeholder click: later you can open remote details page or panel
    el.addEventListener("click", () => {
      alert(`Remote: ${item.name}\n\n(این فعلاً Placeholder است؛ بعداً می‌تونیم صفحه Details یا کنترل ریموت را طراحی کنیم)`);
    });

    container.appendChild(el);
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setupSearch(all) {
  const input = document.getElementById("searchInput");
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    const filtered = all.filter(d =>
      (d.name || "").toLowerCase().includes(q) ||
      (d.last || "").toLowerCase().includes(q) ||
      (d.tag || "").toLowerCase().includes(q)
    );
    render(filtered);
  });
}

function main() {
  seedIfEmpty();
  const all = loadDevices();

  render(all);
  setupSearch(all);

  const searchBtn = document.getElementById("searchBtn");
  const addBtn = document.getElementById("addBtn");
  const searchRow = document.getElementById("searchRow");
  const searchInput = document.getElementById("searchInput");

  searchBtn.addEventListener("click", () => {
    searchRow.classList.toggle("show");
    if (searchRow.classList.contains("show")) {
      searchInput.focus();
    } else {
      searchInput.value = "";
      render(loadDevices());
    }
  });

  addBtn.addEventListener("click", () => {
    window.location.href = "addDevice.html";
  });
}

document.addEventListener("DOMContentLoaded", main);
