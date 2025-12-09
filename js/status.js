// STATUS PAGE LOGIC

const tbody     = document.getElementById("clientsBody");
const errorBox  = document.getElementById("statusError");
const hostLabel = document.getElementById("apHostName");
const refreshBtn = document.getElementById("refreshBtn");

const proto = location.protocol === "https:" ? "wss://" : "ws://";
const ws = new WebSocket(proto + location.host + "/ws");

function requestStatus() {
  // طبق PDF باید Active Clients و AP HostName خوانده شود
  ws.send(JSON.stringify({
    setting: "status",
    action: "read",
    fields: ["AP HostName","Active Clients"]
  }));
}

ws.onopen = () => {
  requestStatus();
};

ws.onmessage = (ev) => {
  let data;
  try { data = JSON.parse(ev.data); } catch { return; }

  if (data["AP HostName"]) {
    hostLabel.textContent = "AP Host: " + data["AP HostName"];
  }

  if (Array.isArray(data["Active Clients"])) {
    const list = data["Active Clients"];

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="4">No active clients.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    list.forEach((client, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${client.name || "-"}</td>
        <td>${client.ip || "-"}</td>
        <td>${client.mac || "-"}</td>
      `;
      tbody.appendChild(tr);
    });
  }
};

ws.onerror = () => {
  errorBox.textContent = "Unable to read status from device.";
};
ws.onclose = () => {
  if (!tbody.children.length) {
    errorBox.textContent = "Connection closed.";
  }
};

refreshBtn.addEventListener("click", () => {
  errorBox.textContent = "";
  tbody.innerHTML = `<tr><td colspan="4">Refreshing…</td></tr>`;
  requestStatus();
});
