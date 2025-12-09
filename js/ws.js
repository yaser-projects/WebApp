// Shared WebSocket helper for all pages
// Provides a simple JSON-first API with optional lifecycle hooks.

const WS_URL = (() => {
  const proto = location.protocol === "https:" ? "wss://" : "ws://";
  return `${proto}${location.host}/ws`;
})();

/**
 * Connect to the backend WebSocket.
 * Handlers can observe lifecycle events and JSON messages.
 *
 * @param {Object} handlers
 * @param {(api: WSApi) => void} [handlers.onOpen]
 * @param {(data: any, api: WSApi) => void} [handlers.onJSON]
 * @param {(event: MessageEvent, api: WSApi) => void} [handlers.onRaw]
 * @param {(api: WSApi) => void} [handlers.onError]
 * @param {(api: WSApi) => void} [handlers.onClose]
 * @returns {WSApi}
 */
export function connectWebSocket(handlers = {}) {
  const ws = new WebSocket(WS_URL);

  const api = {
    raw: ws,
    /**
     * Send a JSON payload if the socket is open.
     */
    sendJSON(payload) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
      } else {
        console.warn("WS not open, ignoring sendJSON");
      }
    },
    /**
     * Close the socket.
     */
    close() {
      ws.close();
    },
  };

  ws.addEventListener("open", () => handlers.onOpen?.(api));

  ws.addEventListener("message", (event) => {
    const parsed = safeParseJSON(event.data);
    if (parsed !== undefined) {
      handlers.onJSON?.(parsed, api);
    } else {
      handlers.onRaw?.(event, api);
    }
  });

  ws.addEventListener("error", () => handlers.onError?.(api));
  ws.addEventListener("close", () => handlers.onClose?.(api));

  return api;
}

function safeParseJSON(data) {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

