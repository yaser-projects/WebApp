// ============================================
// Metal Brain - Shared WebSocket Module
// ============================================
// All WebSocket JSON messages MUST live here.
//
// Events dispatched on window:
//   - ws-status              { connected:boolean, url?:string, error?:boolean }
//   - ws-message             (all JSON messages)
//
// Remote Scan events:
//   - remote-scan:read       { RF_SCAN_* ... }
//   - remote-scan:ack        { error:false, message:string }
//   - remote-scan:start      { message:"Band scan requested" }
//   - remote-scan:progress   { type:"band_scan.progress", ... }
//   - remote-scan:found      { type:"user.band_scan.found", ... }
//   - remote-scan:hit        { type:"user.band_scan.hit", ... }
//   - remote-scan:done       { progress:100 }
//
// Device Info (About) events:
//   - device:info            { info: string[], raw: object }

const WS_CONFIG = {
  FALLBACK_HOST: "192.168.1.2",
  WS_PORT: "",
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
  const fallbackHost = WS_CONFIG.FALLBACK_HOST;
  const port = WS_CONFIG.WS_PORT;
  const path = WS_CONFIG.WS_PATH;

  if (WS_CONFIG.USE_DEVICE_FIRST) {
    urls.push(buildWSURL(fallbackHost, port, path));
    if (currentHost !== "localhost" && currentHost !== "127.0.0.1") {
      urls.push(buildWSURL(currentHost, port, path));
    }
  } else {
    if (currentHost !== "localhost" && currentHost !== "127.0.0.1") {
      urls.push(buildWSURL(currentHost, port, path));
    }
    urls.push(buildWSURL(fallbackHost, port, path));
  }

  if (urls.length === 0) urls.push(buildWSURL("localhost", port, path));
  return urls;
}

class WSConnection {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.ws = null;
    this.urls = getWSURLs();
    this.currentUrlIndex = 0;
    this.reconnectTimer = null;
    this.shouldReconnect = true;
    this.isConnecting = false;

    // Remote Scan state
    this._remoteScan = {
      pendingStartAfterWrite: false,
      active: false,
    };
  }

  _emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;

    this.isConnecting = true;
    const url = this.urls[this.currentUrlIndex];
    console.log(`[WS] Connecting to: ${url}`);

    try {
      this.ws = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      console.error("[WS] Connection error:", error);
      this.handleConnectionFailure();
    }
  }

  setupEventHandlers() {
    const ws = this.ws;

    ws.onopen = () => {
      console.log(`[WS] Connected to: ${ws.url}`);
      this.isConnecting = false;
      this.currentUrlIndex = 0;
      this.handlers.onOpen?.(this);
      this._emit("ws-status", { connected: true, url: ws.url });
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

      // Device Info (About)
      this._handleDeviceInfoInbound(data);

      // Remote Scan protocol
      this._handleRemoteScanInbound(data);

      // user handlers
      this.handlers.onJSON?.(data, this);

            // Device Info (About)
      this._handleDeviceInfoInbound(data);

      // Status - AP Clients
      this._handleAPClientsInbound(data);

      // Remote Scan protocol
      this._handleRemoteScanInbound(data);

    };

    ws.onerror = (error) => {
      console.error("[WS] Error:", error);
      this.handlers.onError?.(this);
      this._emit("ws-status", { connected: false, error: true });
    };

    ws.onclose = () => {
      console.log("[WS] Connection closed");
      this.isConnecting = false;
      this.handlers.onClose?.(this);

      this._remoteScan.active = false;
      this._remoteScan.pendingStartAfterWrite = false;

      this._emit("ws-status", { connected: false });

      if (this.shouldReconnect && !this.isConnecting) this.scheduleReconnect();
    };
  }

  handleConnectionFailure() {
    this.isConnecting = false;
    this.currentUrlIndex++;

    if (this.currentUrlIndex < this.urls.length) {
      setTimeout(() => this.connect(), 500);
    } else {
      console.error("[WS] All connection attempts failed");
      this.currentUrlIndex = 0;
      if (this.shouldReconnect) this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.currentUrlIndex = 0;
      this.connect();
    }, WS_CONFIG.RECONNECT_DELAY);
  }

  sendJSON(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    console.warn("[WS] Cannot send: socket not open");
    return false;
  }

  close() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get readyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }
  get isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // =========================================================
  // Device Info (About) API (MESSAGE LIVES HERE)
  // =========================================================
  deviceInfoRead() {
    return this.sendJSON({
      setting: "device",
      action: "read",
      fields: ["Device Info"],
    });
  }

  _handleDeviceInfoInbound(data) {
    if (!data || typeof data !== "object") return;

    const info = data["Device Info"];
    if (Array.isArray(info)) {
      this._emit("device:info", { info, raw: data });
    }
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

    // نمونه دریافتی شما:
    // {"AP Station Num":1,"Scan Active Clients":[["Device 0","192.168.1.5","a5..."],...],"AP HostName":"MB_Device"}

    const hasAny =
      ("AP Station Num" in data) ||
      ("Active Clients" in data) ||
      ("Scan Active Clients" in data) ||
      ("AP HostName" in data);

    if (!hasAny) return;

    const stationNum = Number(data["AP Station Num"]);
    const hostName = (typeof data["AP HostName"] === "string") ? data["AP HostName"] : undefined;

    // بعضی فریمور‌ها ممکنه با کلیدهای متفاوت بفرستن، هر دو را پوشش می‌دهیم
    const clientsRaw =
      data["Active Clients"] ??
      data["Scan Active Clients"];

    const clients = Array.isArray(clientsRaw) ? clientsRaw : [];

    this._emit("ap-clients:read", {
      stationNum: Number.isFinite(stationNum) ? stationNum : undefined,
      clients,
      hostName,
      raw: data,
    });
  }


  // =========================================================
  // Remote Scan API (ALL MESSAGES LIVE HERE)
  // =========================================================
  remoteScanRead() {
    return this.sendJSON({
      setting: "user",
      action: "read",
      fields: ["RF_SCAN_START_MHZ", "RF_SCAN_END_MHZ", "RF_SCAN_STEP_MHZ", "RF_SCAN_DWELL_MS"],
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
        return;
      }

      if (data.message === "Band scan requested") {
        this._remoteScan.active = true;
        this._emit("remote-scan:start", data);
        return;
      }

      return;
    }

    if (typeof data.type !== "string") return;

    if (data.type === "band_scan.progress") {
      this._emit("remote-scan:progress", data);
      if ((data.progress ?? 0) >= 100) {
        this._remoteScan.active = false;
        this._emit("remote-scan:done", { progress: 100 });
      }
      return;
    }

    if (data.type === "user.band_scan.found") {
      this._emit("remote-scan:found", data);
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
