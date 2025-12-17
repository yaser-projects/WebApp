(() => {
  const $ = (id) => document.getElementById(id);

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

  // MAUI host bridge
  // window.MBHost = { loginDevice(payload) }
  const Host = () => window.MBHost || null;

  const safeCall = async (fnName, payload) => {
    const h = Host();
    if (!h || typeof h[fnName] !== "function") {
      console.warn(`MBHost.${fnName} is not implemented yet`, payload);
      // demo success for UI test
      await new Promise(r => setTimeout(r, 400));
      return { ok: true, demo: true };
    }
    return await h[fnName](payload);
  };

  const doLogin = async () => {
    clearErrors();

    const username = String($("deviceUser").value || "").trim() || "admin";
    const password = String($("devicePass").value || "");

    if (!password) return setError("devicePass", "errDevicePass", "Password is required.");

    busy(true);
    try {
      const res = await safeCall("loginDevice", { username, password });

      if (!res || res.ok !== true) {
        showBanner((res && res.message) ? res.message : "Login failed. Please try again.");
        return;
      }

      showBanner("Login succeed (demo). Host should navigate to Dashboard.");
    } catch (e) {
      console.error(e);
      showBanner("Unexpected error. Please try again.");
    } finally {
      busy(false);
    }
  };

  $("togglePass").addEventListener("click", () => togglePass("devicePass"));
  $("btnLoginDevice").addEventListener("click", doLogin);

  // defaults
  $("deviceUser").value = "admin";
})();
