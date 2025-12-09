// ==========================
// METAL BRAIN - NETWORK JS
// ==========================

// کمک‌ها
function parseIPv4(str) {
  const parts = str.trim().split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map(p => {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return NaN;
    return n;
  });
  if (nums.some(n => Number.isNaN(n))) return null;
  return nums;
}

function ipv4ToString(arr) {
  if (!Array.isArray(arr) || arr.length !== 4) return "";
  return arr.join(".");
}

function macToString(arr) {
  if (!Array.isArray(arr) || arr.length !== 6) return "";
  return arr.map(b => b.toString(16).padStart(2, "0")).join(":");
}

// آکاردئون‌ها
const accordions = document.querySelectorAll(".accordion");
accordions.forEach(acc => {
  const header = acc.querySelector(".accordion-header");
  header.addEventListener("click", () => {
    accordions.forEach(a => a.classList.remove("open"));
    acc.classList.add("open");

    const section = acc.dataset.section;
    if (section === "ap") readAP();
    if (section === "sta") readSTA();
    if (section === "sec") readSec();
  });
});

// پیش‌فرض: AP باز باشد
if (accordions[0]) {
  accordions[0].classList.add("open");
}

// وب‌سوکت
const proto = location.protocol === "https:" ? "wss://" : "ws://";
const ws = new WebSocket(proto + location.host + "/ws");

ws.onopen = () => {
  // در ابتدا AP را بخوان
  readAP();
};

ws.onmessage = (ev) => {
  let data;
  try { data = JSON.parse(ev.data); } catch { return; }

  // پرکردن فیلدهای AP
  if (data["AP SSID"] !== undefined) {
    document.getElementById("apSsid").value = data["AP SSID"] || "";
  }
  if (data["AP Pre-Shared Key"] !== undefined) {
    document.getElementById("apKey").value = data["AP Pre-Shared Key"] || "";
  }
  if (data["Ssid Hidden"] !== undefined) {
    document.getElementById("apHidden").checked = !!data["Ssid Hidden"];
  }
  if (data["AP HostName"] !== undefined) {
    document.getElementById("apHostname").value = data["AP HostName"] || "";
  }
  if (data["AP IPv4"]) {
    document.getElementById("apIPv4").value = ipv4ToString(data["AP IPv4"]);
  }
  if (data["AP IPv6"]) {
    // به صورت string نمایش می‌دهیم
    document.getElementById("apIPv6").value = data["AP IPv6"];
  }
  if (data["AP Port"] !== undefined) {
    document.getElementById("apPort").value = data["AP Port"];
  }
  if (data["Wifi Channel"] !== undefined) {
    document.getElementById("apChannel").value = String(data["Wifi Channel"]);
  }
  if (data["Max Connection"] !== undefined) {
    document.getElementById("apMaxConn").value = String(data["Max Connection"]);
  }
  if (data["AP MAC"]) {
    document.getElementById("apMac").value = macToString(data["AP MAC"]);
  }
  if (data["Gateway"]) {
    document.getElementById("apGateway").value = ipv4ToString(data["Gateway"]);
  }
  if (data["Subnet"]) {
    document.getElementById("apSubnet").value = ipv4ToString(data["Subnet"]);
  }
  if (data["Primary DNS"]) {
    document.getElementById("apDns1").value = ipv4ToString(data["Primary DNS"]);
  }
  if (data["Secondary DNS"]) {
    document.getElementById("apDns2").value = ipv4ToString(data["Secondary DNS"]);
  }

  // Station
  if (data["Modem SSID"] !== undefined) {
    document.getElementById("staSsid").value = data["Modem SSID"] || "";
  }
  if (data["Modem Pre-Shared Key"] !== undefined) {
    document.getElementById("staKey").value = data["Modem Pre-Shared Key"] || "";
  }
  if (data["STA HostName"] !== undefined) {
    document.getElementById("staHost").value = data["STA HostName"] || "";
  }
  if (data["Modem IP"]) {
    document.getElementById("staIp").value = ipv4ToString(data["Modem IP"]);
  }
  if (data["STA MAC"]) {
    document.getElementById("staMac").value = macToString(data["STA MAC"]);
  }
  if (data["Modem MAC"]) {
    document.getElementById("modemMac").value = macToString(data["Modem MAC"]);
  }

  // Security
  if (data.username !== undefined) {
    document.getElementById("secUser").value = data.username || "";
  }
  if (data.password !== undefined) {
    document.getElementById("secPass").value = data.password || "";
  }
};

ws.onerror = () => {
  console.warn("WS error in network settings");
};

// ========= AP section =========
const apError = document.getElementById("apError");
document.getElementById("apReadBtn").addEventListener("click", readAP);
document.getElementById("apSaveBtn").addEventListener("click", saveAP);

function readAP() {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    setting: "device",
    action: "read",
    fields: [
      "AP SSID","AP Pre-Shared Key","Ssid Hidden",
      "AP IPv4","AP IPv6","AP Port","AP HostName",
      "Wifi Channel","Max Connection","AP MAC",
      "Gateway","Subnet","Primary DNS","Secondary DNS"
    ]
  }));
}

function saveAP() {
  const ssid = document.getElementById("apSsid").value.trim();
  const key  = document.getElementById("apKey").value.trim();
  const hidden = document.getElementById("apHidden").checked;
  const host = document.getElementById("apHostname").value.trim();
  const ipv4 = document.getElementById("apIPv4").value.trim();
  const ipv6 = document.getElementById("apIPv6").value.trim();
  const port = Number(document.getElementById("apPort").value.trim());
  const chan = document.getElementById("apChannel").value;
  const maxc = Number(document.getElementById("apMaxConn").value);
  const gw   = document.getElementById("apGateway").value.trim();
  const sub  = document.getElementById("apSubnet").value.trim();
  const dns1 = document.getElementById("apDns1").value.trim();
  const dns2 = document.getElementById("apDns2").value.trim();

  // ولیدیشن طبق PDF
  if (!ssid || ssid.length > 32 || ssid === "Metal Brain") {
    apError.textContent = "SSID must be 1–32 chars and not 'Metal Brain'.";
    return;
  }
  if (!key || key.length < 8 || key.length > 64) {
    apError.textContent = "Pre-Shared Key must be 8–64 chars.";
    return;
  }

  const ipv4Arr = parseIPv4(ipv4);
  const gwArr   = parseIPv4(gw);
  const subArr  = parseIPv4(sub);
  const dns1Arr = parseIPv4(dns1);
  const dns2Arr = parseIPv4(dns2);

  if (!ipv4Arr || !gwArr || !subArr || !dns1Arr || !dns2Arr) {
    apError.textContent = "IPv4, Gateway, Subnet and DNS must be valid IPv4 addresses.";
    return;
  }
  if (!host || host.length > 16) {
    apError.textContent = "Hostname must be 1–16 characters.";
    return;
  }
  if (Number.isNaN(port) || port < 0 || port > 65535) {
    apError.textContent = "Port must be between 0 and 65535.";
    return;
  }
  if (chan !== "auto") {
    const cNum = Number(chan);
    if (Number.isNaN(cNum) || cNum < 1 || cNum > 13) {
      apError.textContent = "WiFi channel must be 1–13 or Auto.";
      return;
    }
  }
  if (Number.isNaN(maxc) || maxc < 1 || maxc > 4) {
    apError.textContent = "Max connection must be 1–4.";
    return;
  }

  apError.textContent = "";

  if (ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({
    setting: "device",
    action: "write",
    fields: {
      "AP SSID": ssid,
      "AP Pre-Shared Key": key,
      "Ssid Hidden": hidden,
      "AP HostName": host,
      "AP IPv4": ipv4Arr,
      "AP IPv6": ipv6,          // به صورت رشته
      "AP Port": port,
      "Wifi Channel": chan === "auto" ? "auto" : Number(chan),
      "Max Connection": maxc,
      "Gateway": gwArr,
      "Subnet": subArr,
      "Primary DNS": dns1Arr,
      "Secondary DNS": dns2Arr
    }
  }));
}

// ========= Station section =========
const staError = document.getElementById("staError");
document.getElementById("staReadBtn").addEventListener("click", readSTA);
document.getElementById("staSaveBtn").addEventListener("click", saveSTA);

function readSTA() {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    setting: "device",
    action: "read",
    fields: [
      "Modem SSID","Modem Pre-Shared Key","STA HostName",
      "Modem IP","Modem MAC","STA MAC"
    ]
  }));
}

function saveSTA() {
  const ssid = document.getElementById("staSsid").value.trim();
  const key  = document.getElementById("staKey").value.trim();
  const host = document.getElementById("staHost").value.trim();

  if (!ssid || ssid.length > 32) {
    staError.textContent = "SSID must be 1–32 characters.";
    return;
  }
  if (key.length > 64) {
    staError.textContent = "Pre-Shared Key must be 0–64 characters.";
    return;
  }
  if (!host || host.length > 16) {
    staError.textContent = "Host name must be 1–16 characters.";
    return;
  }

  staError.textContent = "";

  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    setting: "device",
    action: "write",
    fields: {
      "Modem SSID": ssid,
      "Modem Pre-Shared Key": key,
      "STA HostName": host
    }
  }));
}

// ========= Security section =========
const secError = document.getElementById("secError");
document.getElementById("secReadBtn").addEventListener("click", readSec);
document.getElementById("secSaveBtn").addEventListener("click", saveSec);

function readSec() {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    setting: "device",
    action: "read",
    fields: ["username","password"]
  }));
}

function saveSec() {
  const u = document.getElementById("secUser").value.trim();
  const p = document.getElementById("secPass").value.trim();

  if (!u || u.length > 16 || !p || p.length > 16) {
    secError.textContent = "Username and password must be 1–16 characters.";
    return;
  }
  secError.textContent = "";

  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    setting: "device",
    action: "write",
    fields: { username: u, password: p }
  }));
}

// ========= Reset Factory =========
const resetBtn = document.getElementById("resetBtn");
const resetCircle = document.getElementById("resetCircle");
const resetCountSpan = document.getElementById("resetCount");
const resetError = document.getElementById("resetError");
let resetTimer = null;

resetBtn.addEventListener("click", () => {
  if (resetTimer) return; // در حال شمارش است

  let count = 7;
  resetCountSpan.textContent = String(count);
  resetCircle.classList.add("active");
  resetError.textContent = "";

  resetTimer = setInterval(() => {
    count -= 1;
    resetCountSpan.textContent = String(count);

    // در 5 → ارسال Reset factory
    if (count === 5 && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        setting: "command",
        action: "push button",
        fields: { "Reset factory": true }
      }));
    }

    if (count <= 0) {
      clearInterval(resetTimer);
      resetTimer = null;
      resetCircle.classList.remove("active");
      // بعد از صفر → برگرد به لاگین
      window.location.href = "index.html";
    }
  }, 1000);
});

