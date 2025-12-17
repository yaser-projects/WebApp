(() => {
  const $ = (id) => document.getElementById(id);

  // --- UI helpers
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

  const togglePass = (inputId) => {
    const el = $(inputId);
    if (!el) return;
    el.type = (el.type === "password") ? "text" : "password";
  };

  // --- Validation (English letters + numbers only, length 1..16)
  const sanitizeAlnum = (v) => String(v || "").replace(/[^a-zA-Z0-9]/g, "");
  const isValidField = (v) => {
    const s = String(v || "");
    if (s.length < 1 || s.length > 16) return false;
    return /^[a-zA-Z0-9]+$/.test(s);
  };

  const btnLogin = $("btnLoginDevice");
  const inpUser = $("deviceUser");
  const inpPass = $("devicePass");

  const updateLoginButtonState = () => {
    const u = inpUser.value;
    const p = inpPass.value;
    const ok = isValidField(u) && isValidField(p);
    btnLogin.disabled = !ok;
  };

  // --- Device stored credentials received on load
  // MUST be kept for final compare on Login click (per PDF)
  let storedCredentials = { username: "", password: "" };

  // --- Messaging bridge (MAUI / ws.js should implement one of these)
  // Prefer: window.MBHost.sendMessage(payload)  OR  window.wsSend(payload)
  const sendMessage = async (payload) => {
    // 1) MAUI host bridge
    if (window.MBHost && typeof window.MBHost.sendMessage === "function") {
      return await window.MBHost.sendMessage(payload);
    }

    // 2) A global wsSend helper (if you have it)
    if (typeof window.wsSend === "function") {
      return window.wsSend(payload);
    }

    // 3) last fallback (for browser demo)
    console.warn("No sendMessage bridge found. Payload:", payload);
    return null;
  };

  // This function should be called by MAUI/ws.js when a JSON message arrives
  // Example incoming: {"username":"admin","password":"admin"} OR {"AP SSID":"Metal Brain"}
  window.loginDevice_onMessage = (data) => {
    try {
      const obj = (typeof data === "string") ? JSON.parse(data) : data;
      if (!obj || typeof obj !== "object") return;

      // Credentials read response
      if (typeof obj.username === "string" && typeof obj.password === "string") {
        storedCredentials.username = obj.username;
        storedCredentials.password = obj.password;

        // show in fields (per PDF)
        inpUser.value = sanitizeAlnum(obj.username).slice(0, 16);
        inpPass.value = sanitizeAlnum(obj.password).slice(0, 16);

        updateLoginButtonState();
        return;
      }

      // AP SSID read response
      if (typeof obj["AP SSID"] === "string") {
        const ssid = obj["AP SSID"];
        if (ssid === "Metal Brain") {
          window.location.href = "quickstart.html";
        } else {
          window.location.href = "dashboard.html";
        }
      }
    } catch (e) {
      console.error("loginDevice_onMessage parse error:", e);
    }
  };

  // --- Load event: send read for username/password (per PDF)
  const readCredentialsOnLoad = async () => {
    busy(true);
    try {
      await sendMessage({
        setting: "device",
        action: "read",
        fields: ["username", "password"]
      });
    } finally {
      busy(false);
    }
  };

  // --- Login click: validate + compare with stored + read AP SSID then route
  const doLogin = async () => {
    clearErrors();

    const username = inpUser.value;
    const password = inpPass.value;

    // validate emptiness + range + allowed chars
    if (!isValidField(username)) {
      setError("deviceUser", "errDeviceUser", "Username must be 1–16 characters (A–Z, 0–9).");
    }
    if (!isValidField(password)) {
      setError("devicePass", "errDevicePass", "Password must be 1–16 characters (A–Z, 0–9).");
    }
    if (!isValidField(username) || !isValidField(password)) return;

    // compare with stored credentials
    if (username !== storedCredentials.username || password !== storedCredentials.password) {
      showBanner("Invalid username or password.");
      return;
    }

    // If OK: read AP SSID then route based on response
    busy(true);
    try {
      await sendMessage({
        setting: "device",
        action: "read",
        fields: ["AP SSID"]
      });
      // routing happens when "AP SSID" message arrives → loginDevice_onMessage
    } finally {
      busy(false);
    }
  };

  // --- Wire events
  $("togglePass").addEventListener("click", () => togglePass("devicePass"));

  // Enforce alnum-only on typing (and keep length <=16)
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

  btnLogin.addEventListener("click", doLogin);

  // Init
  updateLoginButtonState();
  document.addEventListener("DOMContentLoaded", readCredentialsOnLoad);
})();
