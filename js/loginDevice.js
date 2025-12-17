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

  // Enforce alnum-only typing
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

  // Eye toggle (with icon swap)
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

  // Stored credentials received on load
  let storedCredentials = { username: "", password: "" };

  // Bridge (MAUI/ws.js)
  const sendMessage = async (payload) => {
    if (window.MBHost && typeof window.MBHost.sendMessage === "function") {
      return await window.MBHost.sendMessage(payload);
    }
    if (typeof window.wsSend === "function") {
      return window.wsSend(payload);
    }
    console.warn("No sendMessage bridge found. Payload:", payload);
    return null;
  };

  // Called by host/ws when a JSON arrives
  window.loginDevice_onMessage = (data) => {
    try {
      const obj = (typeof data === "string") ? JSON.parse(data) : data;
      if (!obj || typeof obj !== "object") return;

      if (typeof obj.username === "string" && typeof obj.password === "string") {
        storedCredentials.username = obj.username;
        storedCredentials.password = obj.password;

        inpUser.value = sanitizeAlnum(obj.username).slice(0, 16);
        inpPass.value = sanitizeAlnum(obj.password).slice(0, 16);
        updateLoginButtonState();
        return;
      }

      if (typeof obj["AP SSID"] === "string") {
        const ssid = obj["AP SSID"];
        window.location.href = (ssid === "Metal Brain") ? "quickstart.html" : "dashboard.html";
      }
    } catch (e) {
      console.error("loginDevice_onMessage parse error:", e);
    }
  };

  // Load: read username/password
  document.addEventListener("DOMContentLoaded", async () => {
    updateLoginButtonState();
    busy(true);
    try {
      await sendMessage({ setting: "device", action: "read", fields: ["username", "password"] });
    } finally {
      busy(false);
    }
  });

  // Login click
  btnLogin.addEventListener("click", async () => {
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

    busy(true);
    try {
      await sendMessage({ setting: "device", action: "read", fields: ["AP SSID"] });
      // routing happens when AP SSID message arrives -> loginDevice_onMessage
    } finally {
      busy(false);
    }
  });
})();
