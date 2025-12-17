(() => {
  // ---------------------------
  // Helpers
  // ---------------------------
  const $ = (id) => document.getElementById(id);

  const busy = (on) => {
    const el = $("busy");
    if (!el) return;
    el.classList.toggle("hidden", !on);
    el.setAttribute("aria-hidden", on ? "false" : "true");
  };

  const showBanner = (msg, type = "error") => {
    const b = $("banner");
    if (!b) return;
    b.textContent = msg || "";
    b.classList.toggle("hidden", !msg);
    // For v1 we keep single style; you can add success styling later.
  };

  const clearErrors = () => {
    [
      "errUsername","errPhone","errPassword",
      "errEmailReset","errPhoneReset","errVerifyCode",
      "errNewPassword","errConfirmPassword"
    ].forEach(id => { const el = $(id); if (el) el.textContent = ""; });

    ["username","phone","password","emailReset","phoneReset","verifyCode","newPassword","confirmPassword"]
      .forEach(id => { const el = $(id); if (el) el.classList.remove("error"); });

    showBanner("");
  };

  const setError = (inputId, errId, msg) => {
    const input = $(inputId);
    const err = $(errId);
    if (input) input.classList.add("error");
    if (err) err.textContent = msg;
  };

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
  const isValidPhone = (v) => {
    const s = String(v || "").trim();
    // v1 ساده: حداقل 8 رقم، + و فاصله و - مجاز
    const digits = s.replace(/[^\d]/g, "");
    return digits.length >= 8;
  };

  const togglePass = (inputId) => {
    const el = $(inputId);
    if (!el) return;
    el.type = (el.type === "password") ? "text" : "password";
  };

  // ---------------------------
  // Views / Steps
  // ---------------------------
  const viewLogin = $("viewLogin");
  const viewForgot = $("viewForgot");

  const showLogin = () => {
    clearErrors();
    viewForgot.classList.add("hidden");
    viewLogin.classList.remove("hidden");
  };

  const showForgot = () => {
    clearErrors();
    viewLogin.classList.add("hidden");
    viewForgot.classList.remove("hidden");
    showFgStep(1);
  };

  const fgStep1 = $("fgStep1");
  const fgStep2 = $("fgStep2");
  const fgStep3 = $("fgStep3");

  const showFgStep = (n) => {
    fgStep1.classList.toggle("hidden", n !== 1);
    fgStep2.classList.toggle("hidden", n !== 2);
    fgStep3.classList.toggle("hidden", n !== 3);
  };

  // ---------------------------
  // Login method (Username / Phone)
  // ---------------------------
  let loginMethod = "username"; // "username" | "phone"
  const fieldUsername = $("fieldUsername");
  const fieldPhone = $("fieldPhone");

  const setLoginMethod = (m) => {
    loginMethod = m;
    $("tabUsername").classList.toggle("active", m === "username");
    $("tabPhone").classList.toggle("active", m === "phone");

    fieldUsername.classList.toggle("hidden", m !== "username");
    fieldPhone.classList.toggle("hidden", m !== "phone");
    clearErrors();
  };

  // ---------------------------
  // Forgot method (Email / SMS)
  // ---------------------------
  let resetMethod = "email"; // "email" | "phone"
  const fieldEmailReset = $("fieldEmailReset");
  const fieldPhoneReset = $("fieldPhoneReset");

  const setResetMethod = (m) => {
    resetMethod = m;
    $("tabEmailReset").classList.toggle("active", m === "email");
    $("tabPhoneReset").classList.toggle("active", m === "phone");
    fieldEmailReset.classList.toggle("hidden", m !== "email");
    fieldPhoneReset.classList.toggle("hidden", m !== "phone");
    clearErrors();
  };

  // ---------------------------
  // Host bridge (MAUI should override these)
  // ---------------------------
  // You can later implement these in MAUI via JS injection:
  // window.MBHost = { loginServer, sendResetCode, verifyResetCode, resetPassword, navigateBack }
  const Host = () => window.MBHost || null;

  const safeCall = async (fnName, payload) => {
    const h = Host();
    if (!h || typeof h[fnName] !== "function") {
      console.warn(`MBHost.${fnName} is not implemented yet`, payload);
      // v1: simulate success so you can test UI
      await new Promise(r => setTimeout(r, 400));
      return { ok: true, demo: true };
    }
    return await h[fnName](payload);
  };

  // ---------------------------
  // Actions
  // ---------------------------
  const doLogin = async () => {
    clearErrors();

    const username = String($("username").value || "").trim();
    const phone = String($("phone").value || "").trim();
    const password = String($("password").value || "");

    if (loginMethod === "username") {
      if (!username) return setError("username", "errUsername", "Username is required.");
    } else {
      if (!phone) return setError("phone", "errPhone", "Phone number is required.");
      if (!isValidPhone(phone)) return setError("phone", "errPhone", "Invalid phone number.");
    }

    if (!password) return setError("password", "errPassword", "Password is required.");

    busy(true);
    try {
      const res = await safeCall("loginServer", {
        method: loginMethod,
        username,
        phone,
        password
      });

      if (!res || res.ok !== true) {
        showBanner((res && res.message) ? res.message : "Login failed. Please try again.");
        return;
      }

      // MAUI should handle navigation after authentication (per spec)
      // For demo: show success banner
      showBanner("Login succeed (demo). Host should navigate to Dashboard.", "success");
    } catch (e) {
      console.error(e);
      showBanner("Unexpected error. Please try again.");
    } finally {
      busy(false);
    }
  };

  let resetTarget = ""; // email or phone
  let resetToken = "";  // if your backend gives a token after sending code

  const sendCode = async () => {
    clearErrors();

    const email = String($("emailReset").value || "").trim();
    const phone = String($("phoneReset").value || "").trim();

    if (resetMethod === "email") {
      if (!email) return setError("emailReset", "errEmailReset", "Email is required.");
      if (!isValidEmail(email)) return setError("emailReset", "errEmailReset", "Invalid email.");
      resetTarget = email;
    } else {
      if (!phone) return setError("phoneReset", "errPhoneReset", "Phone number is required.");
      if (!isValidPhone(phone)) return setError("phoneReset", "errPhoneReset", "Invalid phone number.");
      resetTarget = phone;
    }

    busy(true);
    try {
      const res = await safeCall("sendResetCode", { method: resetMethod, target: resetTarget });
      if (!res || res.ok !== true) {
        showBanner((res && res.message) ? res.message : "Failed to send code.");
        return;
      }
      resetToken = res.token || "";
      showFgStep(2);
    } catch (e) {
      console.error(e);
      showBanner("Unexpected error. Please try again.");
    } finally {
      busy(false);
    }
  };

  const verifyCode = async () => {
    clearErrors();

    const code = String($("verifyCode").value || "").trim();
    if (!code) return setError("verifyCode", "errVerifyCode", "Verification code is required.");
    if (code.replace(/[^\d]/g, "").length < 4) return setError("verifyCode", "errVerifyCode", "Invalid code.");

    busy(true);
    try {
      const res = await safeCall("verifyResetCode", {
        method: resetMethod,
        target: resetTarget,
        code,
        token: resetToken
      });

      if (!res || res.ok !== true) {
        showBanner((res && res.message) ? res.message : "Verification failed.");
        return;
      }

      // backend can return a stronger token for reset step
      resetToken = res.token || resetToken;
      showFgStep(3);
    } catch (e) {
      console.error(e);
      showBanner("Unexpected error. Please try again.");
    } finally {
      busy(false);
    }
  };

  const resetPassword = async () => {
    clearErrors();

    const p1 = String($("newPassword").value || "");
    const p2 = String($("confirmPassword").value || "");

    if (!p1) return setError("newPassword", "errNewPassword", "New password is required.");
    if (p1.length < 6) return setError("newPassword", "errNewPassword", "Minimum 6 characters.");
    if (p2 !== p1) return setError("confirmPassword", "errConfirmPassword", "Passwords do not match.");

    busy(true);
    try {
      const res = await safeCall("resetPassword", {
        method: resetMethod,
        target: resetTarget,
        newPassword: p1,
        token: resetToken
      });

      if (!res || res.ok !== true) {
        showBanner((res && res.message) ? res.message : "Failed to reset password.");
        return;
      }

      // success → back to login
      showBanner("Password updated. Please login.", "success");
      showLogin();
    } catch (e) {
      console.error(e);
      showBanner("Unexpected error. Please try again.");
    } finally {
      busy(false);
    }
  };

  // ---------------------------
  // Events
  // ---------------------------
  $("tabUsername").addEventListener("click", () => setLoginMethod("username"));
  $("tabPhone").addEventListener("click", () => setLoginMethod("phone"));

  $("togglePass").addEventListener("click", () => togglePass("password"));
  $("toggleNewPass").addEventListener("click", () => togglePass("newPassword"));

  $("btnLogin").addEventListener("click", doLogin);
  $("btnForgot").addEventListener("click", showForgot);

  $("tabEmailReset").addEventListener("click", () => setResetMethod("email"));
  $("tabPhoneReset").addEventListener("click", () => setResetMethod("phone"));

  $("btnBackToLogin1").addEventListener("click", showLogin);
  $("btnBackToStep1").addEventListener("click", () => showFgStep(1));
  $("btnBackToStep2").addEventListener("click", () => showFgStep(2));

  $("btnSendCode").addEventListener("click", sendCode);
  $("btnVerifyCode").addEventListener("click", verifyCode);
  $("btnResetPassword").addEventListener("click", resetPassword);

  $("resendLink").addEventListener("click", (e) => {
    e.preventDefault();
    sendCode();
  });


  // default state
  setLoginMethod("username");
  setResetMethod("email");
  showLogin();
})();
