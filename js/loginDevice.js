import { connectWebSocket } from "./ws.js";

(() => {
  const $ = (id) => document.getElementById(id);

  // Validation: English letters + numbers only, length 1..16
  const sanitizeAlnum = (v) => String(v || "").replace(/[^a-zA-Z0-9]/g, "");
  const isValidField = (v) => {
    const s = String(v || "");
    if (s.length < 1 || s.length > 16) return false;
    return /^[a-zA-Z0-9]+$/.test(s);
  };

  const busy = (on) => {
    const el = $("busy");
    if (!el) return;
    el.classList.toggle("hidden", !on);
    el.setAttribute("aria-hidden", on ? "false" : "true");
  };

  const showBanner = (msg) => {
    const b = $("banner");
    if (!b) return;
    b.textContent = msg || "";
    b.classList.toggle("hidden", !msg);
  };

  const clearErrors = () => {
    ["errDeviceUser","errDevicePass"].forEach(id => { const el = $(id); if (el) el.textContent = ""; });
    ["deviceUser","devicePass"].forEach(id => { const el = $(id); if (el) el.classList.remove("error"); });
    showBanner("");
  };

  const setError = (inputId, errId, msg) => {
    const input = $(inputId);
    const err = $(errId);
    if (input) input.classList.add("error");
    if (err) err.textContent = msg;
  };

  const btnLogin = $("btnLoginDevice");
  const inpUser = $("deviceUser");
  const inpPass = $("devicePass");

  const updateLoginButtonState = () => {
    btnLogin.disabled = !(isValidField(inpUser.value) && isValidField(inpPass.value));
  };

  // enforce typing alnum
  inpUser.addEventListener("input", () => {
    const s = sanitizeAlnum(inpUser.value).slice(0, 16);
    if (inpUser.value !== s) inpUser.value = s;
    updateLoginButtonState();
  });

  inpPass.addEventListener("input", () => {
    const s = sanitizeAlnum(inpPass.value).slice(0, 16);
    if (inpPass.value !== s) inpPass.value = s;
    updateLoginButtonState();
  });

  // eye toggle (SVG)
  $("togglePass").addEventListener("click", () => {
    const el = $("devicePass");
    const eyeOpen = $("eyeOpen");
    const eyeOff  = $("eyeOff");

    const toText = el.type === "password";
    el.type = toText ? "text" : "password";

    if (eyeOpen && eyeOff) {
      eyeOpen.classList.toggle("hidden", toText);
      eyeOff.classList.toggle("hidden", !toText);
    }
  });

  // ------------------------------------------------
  // WebSocket wiring (REAL) - based on ws.js
  // ------------------------------------------------
  let ws = null;

  // Stored credentials received on load (per PDF)
  let storedCredentials = { username: "", password: "" };

  // Listen to ws.js window events
  // - net-sec:read => contains username/password
  // - net-ap:read  => contains AP SSID
  window.addEventListener("net-sec:read", (ev) => {
    const data = ev?.detail;
    if (!data || typeof data !== "object") return;

    if (typeof data.username === "string" && typeof data.password === "string") {
      storedCredentials.username = data.username;
      storedCredentials.password = data.password;

      // show in fields
      inpUser.value = sanitizeAlnum(data.username).slice(0, 16);
      inpPass.value = sanitizeAlnum(data.password).slice(0, 16);

      updateLoginButtonState();
    }
  });

  window.addEventListener("net-ap:read", (ev) => {
    const data = ev?.detail;
    if (!data || typeof data !== "object") return;

    if (typeof data["AP SSID"] === "string") {
      const ssid = data["AP SSID"];
      window.location.href = (ssid === "Metal Brain") ? "quickstart.html" : "dashboard.html";
    }
  });

  // Connect and read credentials on open
  const initWS = () => {
    ws = connectWebSocket({
      onOpen: (conn) => {
        // Load event requirement (PDF): read username/password
        // equivalent method exists in ws.js:
        // conn.networkSecurityRead()
        busy(true);
        conn.networkSecurityRead();
        setTimeout(() => busy(false), 250);
      }
    });
  };

  // Login click logic (per PDF)
  btnLogin.addEventListener("click", () => {
    clearErrors();

    const username = inpUser.value;
    const password = inpPass.value;

    if (!isValidField(username)) setError("deviceUser", "errDeviceUser", "Username must be 1–16 characters (A–Z, 0–9).");
    if (!isValidField(password)) setError("devicePass", "errDevicePass", "Password must be 1–16 characters (A–Z, 0–9).");
    if (!isValidField(username) || !isValidField(password)) return;

    if (username !== storedCredentials.username || password !== storedCredentials.password) {
      showBanner("Invalid username or password.");
      return;
    }

    // If credentials OK: read AP SSID then route
    if (!ws) {
      showBanner("WebSocket is not connected.");
      return;
    }

    busy(true);
    ws.sendJSON({ setting: "device", action: "read", fields: ["AP SSID"] });
    setTimeout(() => busy(false), 250);
  });

  // init
  updateLoginButtonState();
  initWS();
})();
