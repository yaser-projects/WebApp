// ============================================
// Metal Brain - Shared WebSocket Module
// ============================================
// Handles WebSocket connections with automatic endpoint detection
// Works in local, LAN, and server environments without manual configuration

/**
 * Configuration for WebSocket connection
 */
const WS_CONFIG = {
  // Fallback IP for direct device connection (ESP32 Access Point)
  FALLBACK_HOST: "192.168.1.2",
  // WebSocket port (empty = default, or specify like "81")
  WS_PORT: "",
  // WebSocket path
  WS_PATH: "/ws",
  // Try device IP first (true) or current host first (false)
  USE_DEVICE_FIRST: true,
  // Connection timeout (ms)
  CONNECT_TIMEOUT: 5000,
  // Reconnect delay (ms)
  RECONNECT_DELAY: 3000,
};

/**
 * Build WebSocket URL from host and port
 */
function buildWSURL(host, port = "", path = "/ws") {
  const proto = location.protocol === "https:" ? "wss://" : "ws://";
  const portStr = port ? `:${port}` : "";
  return `${proto}${host}${portStr}${path}`;
}

/**
 * Get list of WebSocket URLs to try (in priority order)
 */
function getWSURLs() {
  const urls = [];
  const currentHost = location.hostname;
  const fallbackHost = WS_CONFIG.FALLBACK_HOST;
  const port = WS_CONFIG.WS_PORT;
  const path = WS_CONFIG.WS_PATH;

  if (WS_CONFIG.USE_DEVICE_FIRST) {
    // Priority 1: Direct device connection (Access Point mode)
    urls.push(buildWSURL(fallbackHost, port, path));
    // Priority 2: Current host (LAN or server)
    if (currentHost !== "localhost" && currentHost !== "127.0.0.1") {
      urls.push(buildWSURL(currentHost, port, path));
    }
  } else {
    // Priority 1: Current host
    if (currentHost !== "localhost" && currentHost !== "127.0.0.1") {
      urls.push(buildWSURL(currentHost, port, path));
    }
    // Priority 2: Direct device connection
    urls.push(buildWSURL(fallbackHost, port, path));
  }

  // Fallback: localhost if nothing else works
  if (urls.length === 0) {
    urls.push(buildWSURL("localhost", port, path));
  }

  return urls;
}

/**
 * WebSocket connection manager
 */
class WSConnection {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.ws = null;
    this.urls = getWSURLs();
    this.currentUrlIndex = 0;
    this.reconnectTimer = null;
    this.shouldReconnect = true;
    this.isConnecting = false;
  }

  /**
   * Connect to WebSocket
   */
  connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

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

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    const ws = this.ws;

    ws.onopen = () => {
      console.log(`[WS] Connected to: ${ws.url}`);
      this.isConnecting = false;
      this.currentUrlIndex = 0; // Reset on success
      this.handlers.onOpen?.(this);
    };

    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        // Non-JSON message
        this.handlers.onRaw?.(event, this);
        return;
      }
      this.handlers.onJSON?.(data, this);
    };

    ws.onerror = (error) => {
      console.error("[WS] Error:", error);
      this.handlers.onError?.(this);
    };

    ws.onclose = () => {
      console.log("[WS] Connection closed");
      this.isConnecting = false;
      this.handlers.onClose?.(this);

      // Auto-reconnect if enabled
      if (this.shouldReconnect && !this.isConnecting) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Handle connection failure - try next URL
   */
  handleConnectionFailure() {
    this.isConnecting = false;
    this.currentUrlIndex++;

    if (this.currentUrlIndex < this.urls.length) {
      // Try next URL
      setTimeout(() => this.connect(), 500);
    } else {
      // All URLs failed
      console.error("[WS] All connection attempts failed");
      this.currentUrlIndex = 0; // Reset for next attempt
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Schedule reconnection
   */
  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.currentUrlIndex = 0; // Reset to try all URLs again
      this.connect();
    }, WS_CONFIG.RECONNECT_DELAY);
  }

  /**
   * Send JSON message
   */
  sendJSON(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    } else {
      console.warn("[WS] Cannot send: socket not open");
      return false;
    }
  }

  /**
   * Close connection
   */
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

  /**
   * Get connection state
   */
  get readyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }

  /**
   * Check if connected
   */
  get isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

/**
 * Create and connect WebSocket instance
 * @param {Object} handlers - Event handlers
 * @param {Function} handlers.onOpen - Called when connection opens
 * @param {Function} handlers.onJSON - Called when JSON message received
 * @param {Function} handlers.onRaw - Called when non-JSON message received
 * @param {Function} handlers.onError - Called on error
 * @param {Function} handlers.onClose - Called when connection closes
 * @returns {WSConnection} WebSocket connection instance
 */
export function connectWebSocket(handlers = {}) {
  const ws = new WSConnection(handlers);
  ws.connect();
  return ws;
}

/**
 * Export configuration for external modification
 */
export { WS_CONFIG };

