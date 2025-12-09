// ABOUT PAGE LOGIC

const infoGrid = document.getElementById("deviceInfo");
const errorBox = document.getElementById("aboutError");

// اتصال وب‌سوکت به /ws روی همان IP
const proto = location.protocol === "https:" ? "wss://" : "ws://";
const ws = new WebSocket(proto + location.host + "/ws");

ws.onopen = () => {
  // طبق PDF باید Device Info خوانده شود
  ws.send(JSON.stringify({
    setting: "device",
    action: "read",
    fields: ["Device Info"]
  }));
};

ws.onmessage = (ev) => {
  let data;
  try { data = JSON.parse(ev.data); } catch { return; }

  if (!data["Device Info"]) return;

  const info = data["Device Info"];
  infoGrid.innerHTML = "";

  Object.keys(info).forEach(key => {
    const div = document.createElement("div");
    div.className = "info-item";
    div.innerHTML = `
      <span class="label">${key}</span>
      <span class="value">${info[key]}</span>
    `;
    infoGrid.appendChild(div);
  });
};

ws.onerror = () => {
  errorBox.textContent = "Unable to read device info.";
};
ws.onclose  = () => {
  if (!infoGrid.children.length) {
    errorBox.textContent = "Connection to device closed.";
  }
};
