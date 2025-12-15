// ============================================
// Metal Brain - WebSocket Client (ALL MESSAGES LIVE HERE)
// ============================================

const WS_CONFIG = {
  // Default device IPs to try (you can override from URL: ?ws=192.168.4.1)
  FALLBACK_HOSTS: ["192.168.1.2", "192.168.4.1"],
  // Leave empty to try common ports automatically ("" -> default 80, then 81)
  WS_PORTS: ["", "81"],
  WS_PATH: "/ws",
  USE_DEVICE_FIRST: true,
  CONNECT_TIMEOUT: 5000,
  RECONNECT_DELAY: 3000,
};

function buildWSURL(host, port = "", path = "/ws") {
  const proto = location.protocol === "https:" ? "wss://" : "ws://";
  const portStr = port ? `:${port}` : "";
  return `${proto}${host}${portStr}${path}`;
}

function getWSURLs() {
  const urls = [];
  const currentHost = location.hostname;

  // Allow override: ?ws=HOST or ?wsHost=HOST
  const params = new URLSearchParams(location.search);
  const overrideHost = params.get("ws") || params.get("wsHost") || "";

  const fallbackHosts = overrideHost
    ? [overrideHost]
    : (Array.isArray(WS_CONFIG.FALLBACK_HOSTS) ? WS_CONFIG.FALLBACK_HOSTS : []);

  const ports =
    Array.isArray(WS_CONFIG.WS_PORTS) && WS_CONFIG.WS_PORTS.length
      ? WS_CONFIG.WS_PORTS
      : ["", "81"];

  const path = WS_CONFIG.WS_PATH;

  const addHost = (host) => {
    if (!host) return;
    ports.forEach((p) => urls.push(buildWSURL(host, p, path)));
  };

  const addCurrent = () => {
    if (!currentHost) return;
    addHost(currentHost);
  };

  if (WS_CONFIG.USE_DEVICE_FIRST) {
    fallbackHosts.forEach(addHost);
    addCurrent();
  } else {
    addCurrent();
    fallbackHosts.forEach(addHost);
  }

  if (urls.length === 0) addHost("localhost");

  // Deduplicate
  return [...new Set(urls)];
}

class WSConnection {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.ws = null;

    this.isConnected = false;
    this.isConnecting = false;

    this.urlIndex = 0;
    this.urls = getWSURLs();

    this._events = new Map();

    // Remote Scan internal state
    this._remoteScan = {
      active: false,
      pendingStartAfterWrite: false,
    };
  }

  on(eventName, cb) {
    if (!this._events.has(eventName)) this._events.set(eventName, new Set());
    this._events.get(eventName).add(cb);
    return () => this.off(eventName, cb);
  }

  off(eventName, cb) {
    const set = this._events.get(eventName);
    if (!set) return;
    set.delete(cb);
  }

  _emit(eventName, payload) {
    // 1) emit داخلی (مثل قبل)
    const set = this._events.get(eventName);
    if (set) {
      for (const cb of set) {
        try {
          cb(payload);
        } catch (e) {
          console.error(`[WS] listener error for ${eventName}:`, e);
        }
      }
    }

    // 2) emit روی window برای فایل‌هایی مثل about.js که window.addEventListener دارند
    try {
      if (typeof window !== "undefined" && window?.dispatchEvent) {
        window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
      }
    } catch (e) {
      console.warn(`[WS] window dispatch failed for ${eventName}:`, e);
    }
  }


  connect() {
    if (this.isConnecting || this.isConnected) return;
    this.isConnecting = true;

    this.urls = getWSURLs();
    this.urlIndex = 0;

    this._connectNext();
  }

  _connectNext() {
    if (this.urlIndex >= this.urls.length) {
      this.isConnecting = false;
      this.isConnected = false;
      this._emit("ws-status", { connected: false, exhausted: true });
      this.handlers.onClose?.(this);
      setTimeout(() => this.connect(), WS_CONFIG.RECONNECT_DELAY);
      return;
    }

    const url = this.urls[this.urlIndex++];
    console.log("[WS] Connecting:", url);

    let ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      console.error("[WS] Failed to create WebSocket:", e);
      this._connectNext();
      return;
    }

    this.ws = ws;

    const timeout = setTimeout(() => {
      if (!this.isConnected) {
        try {
          ws.close();
        } catch { }
        this._connectNext();
      }
    }, WS_CONFIG.CONNECT_TIMEOUT);

    ws.onopen = () => {
      clearTimeout(timeout);
      console.log("[WS] Connected:", url);
      this.isConnected = true;
      this.isConnecting = false;

      this.handlers.onOpen?.(this);
      this._emit("ws-status", { connected: true, url });
    };

    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        this.handlers.onRaw?.(event, this);
        return;
      }

      // broadcast raw JSON
      this._emit("ws-message", data);

      // Internal handlers (each ONLY ONCE)
      this._handleDeviceInfoInbound(data);        // About
      this._handleAPClientsInbound(data);         // Status
      this._handleNetworkSettingsInbound(data);   // Network Settings ✅
      this._handleRemoteScanInbound(data);        // Remote Scan

      // user handlers
      this.handlers.onJSON?.(data, this);
    };

    ws.onerror = (error) => {
      console.error("[WS] Error:", error);
      this.handlers.onError?.(this);
      this._emit("ws-status", { connected: false, error: true });
    };

    ws.onclose = () => {
      console.log("[WS] Connection closed");
      this.isConnecting = false;
      this.isConnected = false;
      this.handlers.onClose?.(this);
      this._emit("ws-status", { connected: false });

      // Reconnect
      setTimeout(() => this.connect(), WS_CONFIG.RECONNECT_DELAY);
    };
  }

  close() {
    try {
      this.ws?.close();
    } catch { }
  }

  sendJSON(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[WS] sendJSON ignored (not connected):", obj);
      return false;
    }
    this.ws.send(JSON.stringify(obj));
    return true;
  }

  // =========================================================
  // About Page (MESSAGE LIVES HERE)
  // =========================================================
  deviceInfoRead() {
    return this.sendJSON({
      setting: "device",
      action: "read",
      fields: [
        "Manufacturer",
        "Device Name",
        "Model Number",
        "Device Model",
        "Production Date",
        "Serial Number",
        "Firmware Version",
      ],
    });
  }

  _handleDeviceInfoInbound(data) {
    // حالت 1: اگر دستگاه به صورت آرایه "Device Info" فرستاد (پشتیبانی قبلی)
    const infoArr = data?.["Device Info"];
    if (Array.isArray(infoArr)) {
      this._emit("device:info", { info: infoArr, raw: data });
      return;
    }

    // حالت 2: پاسخ واقعی دستگاه شما: فیلدهای جدا جدا
    const requiredKeys = [
      "Manufacturer",
      "Device Name",
      "Model Number",
      "Device Model",
      "Production Date",
      "Serial Number",
      "Firmware Version",
    ];

    const hasAny = requiredKeys.some((k) => data?.[k] !== undefined);
    if (!hasAny) return;

    // تبدیل به آرایه دقیقاً به ترتیبی که about.js انتظار دارد
    const built = requiredKeys.map((k) => (data?.[k] ?? ""));

    this._emit("device:info", { info: built, raw: data });
  }


  // =========================================================
  // Status Page - Active DHCP Clients (MESSAGE LIVES HERE)
  // =========================================================
  apClientsRead() {
    return this.sendJSON({
      setting: "device",
      action: "read",
      fields: ["AP Station Num", "Active Clients", "AP HostName"],
    });
  }

  _handleAPClientsInbound(data) {
    if (!data || typeof data !== "object") return;

    const hasAny =
      ("AP Station Num" in data) ||
      ("Active Clients" in data) ||
      ("Scan Active Clients" in data) ||
      ("AP HostName" in data);

    if (!hasAny) return;

    const stationNum = Number(data["AP Station Num"]);
    const hostName = (typeof data["AP HostName"] === "string") ? data["AP HostName"] : undefined;

    const clientsRaw =
      data["Active Clients"] ??
      data["Scan Active Clients"];

    const clients = Array.isArray(clientsRaw) ? clientsRaw : [];

    this._emit("ap-clients:read", {
      stationNum: Number.isFinite(stationNum) ? stationNum : 0,
      hostName,
      clients,
      raw: data,
    });
  }

  // =========================================================
  // Network Settings - READ/WRITE (ALL MESSAGES LIVE HERE)
  // =========================================================
  networkApReadAll() {
    return this.sendJSON({
      setting: "device",
      action: "read",
      fields: [
        "AP SSID",
        "AP Pre-Shared Key",
        "Ssid Hidden",
        "AP IPv4",
        "AP IPv6",
        "AP Port",
        "AP HostName",
        "Wifi Channel",
        "Max Connection",
        "AP MAC",
        "Gateway",
        "Subnet",
        "Primary DNS",
        "Secondary DNS",
      ],
    });
  }

  networkApWrite(fields) {
    return this.sendJSON({
      setting: "device",
      action: "write",
      fields,
    });
  }

  networkStaReadAll() {
    return this.sendJSON({
      setting: "device",
      action: "read",
      fields: [
        "Modem SSID",
        "Modem Pre-Shared Key",
        "STA HostName",
        "Modem IP",
        "Modem MAC",
        "STA MAC",
      ],
    });
  }

  networkStaWrite(fields) {
    return this.sendJSON({
      setting: "device",
      action: "write",
      fields,
    });
  }

  networkSecurityRead() {
    return this.sendJSON({
      setting: "device",
      action: "read",
      fields: ["username", "password"],
    });
  }

  networkSecurityWrite(fields) {
    return this.sendJSON({
      setting: "device",
      action: "write",
      fields,
    });
  }

  // Commands used in Network Settings
  pushButtonConfig() {
    return this.sendJSON({
      setting: "command",
      action: "push button",
      fields: { Config: true },
    });
  }

  resetFactoryCommand() {
    return this.sendJSON({
      setting: "command",
      action: "push button",
      fields: { "Reset factory": true },
    });
  }

  // Network Settings inbound router
  _handleNetworkSettingsInbound(data) {
    if (!data || typeof data !== "object") return;

    // acks
    if (data.error === false && typeof data.message === "string") {
      this._emit("device:settings:saved", data);
      return;
    }
    if (data.error === true && typeof data.message === "string") {
      this._emit("device:settings:error", data);
      return;
    }

    const hasAP =
      ("AP SSID" in data) ||
      ("AP Pre-Shared Key" in data) ||
      ("Ssid Hidden" in data) ||
      ("AP IPv4" in data) ||
      ("AP IPv6" in data) ||
      ("AP Port" in data) ||
      ("AP HostName" in data) ||
      ("Wifi Channel" in data) ||
      ("Max Connection" in data) ||
      ("AP MAC" in data) ||
      ("Gateway" in data) ||
      ("Subnet" in data) ||
      ("Primary DNS" in data) ||
      ("Secondary DNS" in data);

    if (hasAP) {
      this._emit("net-ap:read", data);
      return;
    }

    const hasSTA =
      ("Modem SSID" in data) ||
      ("Modem Pre-Shared Key" in data) ||
      ("STA HostName" in data) ||
      ("Modem IP" in data) ||
      ("Modem MAC" in data) ||
      ("STA MAC" in data);

    if (hasSTA) {
      this._emit("net-sta:read", data);
      return;
    }

    const hasSEC =
      ("username" in data) ||
      ("password" in data);

    if (hasSEC) {
      this._emit("net-sec:read", data);
      return;
    }
  }

  // =========================================================
  // Remote Scan (already used in your UI)
  // =========================================================
  remoteScanRead() {
    return this.sendJSON({
      setting: "user",
      action: "read",
      fields: [
        "RF_SCAN_START_MHZ",
        "RF_SCAN_END_MHZ",
        "RF_SCAN_STEP_MHZ",
        "RF_SCAN_DWELL_MS",
      ],
    });
  }

  remoteScanWrite(s) {
    return this.sendJSON({
      setting: "user",
      action: "write",
      fields: {
        RF_SCAN_START_MHZ: s.start,
        RF_SCAN_END_MHZ: s.end,
        RF_SCAN_STEP_MHZ: s.step,
        RF_SCAN_DWELL_MS: s.dwell,
      },
    });
  }

  remoteScanCommandStart() {
    return this.sendJSON({
      setting: "user",
      action: "command",
      fields: { "Scan Band": true },
    });
  }

  remoteScanStart(s) {
    this._remoteScan.pendingStartAfterWrite = true;
    this._remoteScan.active = false;
    return this.remoteScanWrite(s);
  }

  _handleRemoteScanInbound(data) {
    if (!data || typeof data !== "object") return;

    const hasRead =
      ("RF_SCAN_START_MHZ" in data) &&
      ("RF_SCAN_END_MHZ" in data) &&
      ("RF_SCAN_STEP_MHZ" in data) &&
      ("RF_SCAN_DWELL_MS" in data);

    if (hasRead) {
      this._emit("remote-scan:read", data);
      return;
    }

    if (data.error === false && typeof data.message === "string") {
      this._emit("remote-scan:ack", data);

      if (data.message === "User settings saved") {
        if (this._remoteScan.pendingStartAfterWrite) {
          this._remoteScan.pendingStartAfterWrite = false;
          this.remoteScanCommandStart();
        }
      }
      return;
    }

    if (data.type === "user.band_scan.status") {
      this._emit("remote-scan:status", data);
      return;
    }

    if (data.type === "user.band_scan.hit") {
      this._emit("remote-scan:hit", data);
      return;
    }
  }
}

export function connectWebSocket(handlers = {}) {
  const ws = new WSConnection(handlers);
  ws.connect();
  return ws;
}

export { WS_CONFIG };
