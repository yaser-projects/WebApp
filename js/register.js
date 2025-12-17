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
    ["errFullName","errUsername","errMobile","errEmail","errPassword","errConfirm"]
      .forEach(id => { const el = $(id); if (el) el.textContent = ""; });

    ["fullName","username","mobile","email","password","confirm"]
      .forEach(id => { const el = $(id); if (el) el.classList.remove("error"); });

    showBanner("");
  };

  const setError = (inputId, errId, msg) => {
    const input = $(inputId);
    const err = $(errId);
    if (input) input.classList.add("error");
    if (err) err.textContent = msg;
  };

  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

  const usernameSanitize = (v) => String(v || "").replace(/[^a-zA-Z0-9_.]/g, "");
  const isUsername = (v) => /^[a-zA-Z0-9_.]{3,16}$/.test(String(v || ""));

  const phoneSanitize = (v) => String(v || "").replace(/[^\d+ ]/g, "");
  const isPhone = (v) => {
    const digits = String(v || "").replace(/[^\d]/g, "");
    return digits.length >= 8;
  };

  const fullNameOk = (v) => String(v || "").trim().length >= 2 && String(v || "").trim().length <= 40;
  const passOk = (v) => String(v || "").length >= 8;

  const btnRegister = $("btnRegister");
  const agree = $("agree");

  const updateBtn = () => {
    const ok =
      fullNameOk($("fullName").value) &&
      isUsername($("username").value) &&
      isPhone($("mobile").value) &&
      isEmail($("email").value) &&
      passOk($("password").value) &&
      $("confirm").value === $("password").value &&
      agree.checked;

    btnRegister.disabled = !ok;
  };

  // typing constraints
  $("username").addEventListener("input", () => {
    const s = usernameSanitize($("username").value).slice(0, 16);
    if ($("username").value !== s) $("username").value = s;
    updateBtn();
  });

  $("mobile").addEventListener("input", () => {
    const s = phoneSanitize($("mobile").value).slice(0, 20);
    if ($("mobile").value !== s) $("mobile").value = s;
    updateBtn();
  });

  ["fullName","email","password","confirm"].forEach(id => {
    $(id).addEventListener("input", updateBtn);
  });
  agree.addEventListener("change", updateBtn);

  // eye toggle
  $("togglePass").addEventListener("click", () => {
    const el = $("password");
    const eyeOpen = $("eyeOpen");
    const eyeOff  = $("eyeOff");
    const toText = el.type === "password";
    el.type = toText ? "text" : "password";
    eyeOpen.classList.toggle("hidden", toText);
    eyeOff.classList.toggle("hidden", !toText);
  });

  // host bridge
  const Host = () => window.MBHost || null;

  const safeCall = async (fnName, payload) => {
    const h = Host();
    if (!h || typeof h[fnName] !== "function") {
      console.warn(`MBHost.${fnName} not implemented`, payload);
      await new Promise(r => setTimeout(r, 500));
      return { ok: true, demo: true };
    }
    return await h[fnName](payload);
  };

  const doRegister = async () => {
    clearErrors();

    const fullName = $("fullName").value.trim();
    const username = $("username").value.trim();
    const mobile   = $("mobile").value.trim();
    const email    = $("email").value.trim();
    const password = $("password").value;

    let ok = true;

    if (!fullNameOk(fullName)) { setError("fullName","errFullName","Full name must be 2–40 characters."); ok = false; }
    if (!isUsername(username)) { setError("username","errUsername","Username must be 3–16 (A–Z, 0–9, _ .)."); ok = false; }
    if (!isPhone(mobile))      { setError("mobile","errMobile","Invalid phone number."); ok = false; }
    if (!isEmail(email))       { setError("email","errEmail","Invalid email address."); ok = false; }
    if (!passOk(password))     { setError("password","errPassword","Password must be at least 8 characters."); ok = false; }
    if ($("confirm").value !== password) { setError("confirm","errConfirm","Passwords do not match."); ok = false; }
    if (!agree.checked) { showBanner("Please accept Terms & Privacy."); ok = false; }

    if (!ok) return;

    busy(true);
    try {
      const res = await safeCall("registerUser", { fullName, username, mobile, email, password });
      if (!res || res.ok !== true) {
        showBanner(res?.message || "Registration failed. Please try again.");
        return;
      }
      showBanner("Registration succeed (demo). Host should navigate to Login.", "success");
      // optionally: window.location.href = "loginServer.html";
    } catch (e) {
      console.error(e);
      showBanner("Unexpected error. Please try again.");
    } finally {
      busy(false);
    }
  };

  btnRegister.addEventListener("click", doRegister);

  // Back to login
  $("btnGoLogin").addEventListener("click", () => {
    window.location.href = "loginServer.html";
  });

  // init
  updateBtn();
})();
