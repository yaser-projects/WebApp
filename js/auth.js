// ===============================
//  Metal Brain - AUTH CONTROLLER
// ===============================

import { connectWebSocket } from "./ws.js";

// عناصر صفحه
const loginForm = document.getElementById("loginForm");
const usernameInp = document.getElementById("username");
const passwordInp = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const togglePwd = document.getElementById("togglePwd");
const errorBox = document.getElementById("loginError");

// داده‌های واقعی دستگاه
let deviceUsername = null;
let devicePassword = null;

// اتصال وب‌سوکت مشترک
const wsClient = connectWebSocket({
    onOpen(api) {
        console.log("WS Connected.");
        // مرحله ۱: گرفتن username/password از دستگاه
        api.sendJSON({
            setting: "device",
            action: "read",
            fields: ["username", "password"]
        });
    },
    onJSON(data, api) {
        // دریافت username/password
        if (data.username && data.password) {
            deviceUsername = data.username;
            devicePassword = data.password;
            console.log("Credentials loaded:", data);
        }

        // دریافت AP SSID برای انتخاب مسیر
        if (data["AP SSID"]) {
            const ssid = data["AP SSID"];

            // ذخیره علامت لاگین
            sessionStorage.setItem("metalbrain-auth", "ok");

            if (ssid === "Metal Brain") {
                window.location.href = "quickstart.html";
            } else {
                window.location.href = "dashboard.html";
            }
        }
    },
    onError() {
        console.warn("WS Error");
    },
    onClose() {
        console.warn("WS Closed");
    }
});

// فعال/غیرفعال کردن دکمه لاگین
function validateForm() {
    const u = usernameInp.value.trim();
    const p = passwordInp.value.trim();

    const ok =
        u.length >= 1 && u.length <= 16 &&
        p.length >= 1 && p.length <= 16;

    loginBtn.disabled = !ok;
}
usernameInp.addEventListener("input", validateForm);
passwordInp.addEventListener("input", validateForm);

// نمایش/مخفی‌کردن پسورد
togglePwd.addEventListener("click", () => {
    passwordInp.type = passwordInp.type === "password" ? "text" : "password";
});

// ارسال روی LOGIN
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const u = usernameInp.value.trim();
    const p = passwordInp.value.trim();

    if (u !== deviceUsername || p !== devicePassword) {
        errorBox.textContent = "Username or password is incorrect.";
        usernameInp.classList.add("field-error");
        passwordInp.classList.add("field-error");
        return;
    }

    // پاک‌کردن خطا
    errorBox.textContent = "";
    usernameInp.classList.remove("field-error");
    passwordInp.classList.remove("field-error");

    // مرحله بعد → گرفتن AP SSID
    wsClient.sendJSON({
        setting: "device",
        action: "read",
        fields: ["AP SSID"]
    });
});

// جلوگیری از دسترسی مستقیم به صفحات
export function requireAuth() {
    if (sessionStorage.getItem("metalbrain-auth") !== "ok") {
        window.location.href = "index.html";
    }
}
