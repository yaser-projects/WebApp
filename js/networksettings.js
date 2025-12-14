//=====================================================================================================
//=====================================================================================================
const dropdownButtons = document.querySelectorAll(".dropdown-btn"); // گرفتن تمام دکمه‌های آکاردیون
let lastOpenedSection = "section-ap";                               // چون پیش‌فرض Access Point بازه
//=====================================================================================================
// تابع برای بستن تمام آکاردیون‌ها
function closeAllDropdowns() {
  document.querySelectorAll(".dropdown-container").forEach(container => {
    container.classList.remove("active");
  });
}
//=====================================================================================================
// ✅ تابع اکولنگی بین IPv4 و IPv6
function setupIPModeSwitch() {
  const ipv4Radio = document.getElementById("ap-ipmode4");
  const ipv6Radio = document.getElementById("ap-ipmode6");
  const ipv4Input = document.getElementById("ap-ipv4");
  const ipv6Input = document.getElementById("ap-ipv6");

  function toggleIPFields() {
    if (ipv4Radio.checked) {
      ipv4Input.disabled = false;
      ipv6Input.disabled = true;
      ipv6Input.value = "";
    } else if (ipv6Radio.checked) {
      ipv6Input.disabled = false;
      ipv4Input.disabled = true;
      ipv4Input.value = "";
    }
  }

  // اتصال رویداد تغییر
  ipv4Radio.addEventListener("change", toggleIPFields);
  ipv6Radio.addEventListener("change", toggleIPFields);

  // اجرای اولیه
  toggleIPFields();
}
//=====================================================================================================
// ✅ تابع تبدیل آرایه عددی به رشته MAC Address هگزادسیمال (برای نمایش)
function formatMAC(macArray) {
  if (!Array.isArray(macArray) || macArray.length !== 6) return "";
  return macArray.map(num => num.toString(16).padStart(2, "0").toUpperCase()).join(":");
}
//=====================================================================================================
// ✅ تابع تبدیل رشته MAC Address به آرایه عددی (برای ذخیره یا ارسال)
function parseMAC(macString) {
  if (typeof macString !== "string") return [];
  const parts = macString.split(":");
  if (parts.length !== 6) return [];
  return parts.map(part => parseInt(part, 16));
}
//=====================================================================================================
// ✅ تبدیل رشته IP (مثل "192.168.1.1") به آرایه عددی [192, 168, 1, 1]
function parseIPv4String(str) {
  const parts = str.trim().split(".");
  if (parts.length !== 4) return null;

  const nums = parts.map(p => {
    const n = parseInt(p);
    return isNaN(n) || n < 0 || n > 255 ? null : n;
  });

  return nums.includes(null) ? null : nums;
};
//=====================================================================================================
// ✅ تبدیل آرایه IPv4 مثل [192,168,1,1] به رشته '192.168.1.1'
function formatIPv4(arr) {
  if (!Array.isArray(arr) || arr.length !== 4) return "";
  return arr.join(".");
};
//=====================================================================================================
// ✅ تبدیل رشته استاندارد IPv6 به آرایه ۱۶ بایتی مناسب برای ارسال در JSON
function parseIPv6String(str) {
  const parts = str.trim().split(":");
  if (parts.length !== 8) return null;

  const bytes = [];
  for (let part of parts) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return null;
    const num = parseInt(part, 16);
    const high = (num >> 8) & 0xFF;
    const low = num & 0xFF;
    bytes.push(high, low);
  }

  return bytes; // خروجی ۱۶ عدد بین ۰ تا ۲۵۵
};
//=====================================================================================================
// ✅ تبدیل آرایه ۱۶ بایتی IPv6 به رشته استاندارد (برای نمایش در فرم)
function formatIPv6(arr) {
  if (!Array.isArray(arr) || arr.length !== 16) return "";
  const parts = [];
  for (let i = 0; i < 16; i += 2) {
    const val = (arr[i] << 8) | arr[i + 1];
    parts.push(val.toString(16).padStart(4, '0'));
  }
  return parts.join(":");
};
//=====================================================================================================
// ✅ دکمه Back → ارسال پیام Config و رفتن به داشبورد
function setupBackButton() {
  const backBtn = document.querySelector(".back-icon");
  if (!backBtn) return;

  backBtn.addEventListener("click", () => {
    centralManager.pushButtonConfig(() => {
      window.location.href = "dashboard.html";
    });
  });
}
//=====================================================================================================
// .................................... ✅ Access Point Part .........................................
//=====================================================================================================
// ✅ اعتبارسنجی SSID 
function setupAPSSIDValidation() {
  const ssidInput = document.getElementById("ap-ssid");
  let errorEl = document.createElement("span");
  errorEl.className = "error-message";
  errorEl.style.display = "block";
  errorEl.style.marginBottom = "10px";
  ssidInput.parentElement.insertAdjacentElement("afterend", errorEl);

  ssidInput.addEventListener("input", () => {
    const value = ssidInput.value.trim();

    if (value.length === 0) {
      ssidInput.parentElement.classList.add("error");
      errorEl.textContent = "SSID is required.";
    } else if (value.length > 32) {
      ssidInput.parentElement.classList.add("error");
      errorEl.textContent = "SSID must be 32 characters or fewer.";
    } else {
      ssidInput.parentElement.classList.remove("error");
      errorEl.textContent = "";
    }
  });
};
//=================================================================================
// ✅ اعتبارسنجی PreSharedKey
function setupAPPreSharedKeyValidation() {
  const keyInput = document.getElementById("ap-preSharedKey");
  let errorEl = document.createElement("span");
  errorEl.className = "error-message";
  errorEl.style.display = "block";
  errorEl.style.marginBottom = "10px";
  keyInput.parentElement.insertAdjacentElement("afterend", errorEl);

  keyInput.addEventListener("input", () => {
    const value = keyInput.value.trim();

    if (value.length === 0) {
      keyInput.parentElement.classList.add("error");
      errorEl.textContent = "Password is required.";
    } else if (value.length < 8 || value.length > 64) {
      keyInput.parentElement.classList.add("error");
      errorEl.textContent = "Password must be between 8 and 64 characters.";
    } else {
      keyInput.parentElement.classList.remove("error");
      errorEl.textContent = "";
    }
  });
};
//=================================================================================
// ✅ اعتبارسنجی Hostname 
function setupAPHostnameValidation() {
  const hostnameInput = document.getElementById("ap-hostname");
  let errorEl = document.createElement("span");
  errorEl.className = "error-message";
  errorEl.style.display = "block";
  errorEl.style.marginBottom = "10px";
  hostnameInput.parentElement.insertAdjacentElement("afterend", errorEl);

  hostnameInput.addEventListener("input", () => {
    const value = hostnameInput.value.trim();

    if (value.length === 0) {
      hostnameInput.parentElement.classList.add("error");
      errorEl.textContent = "Host Name is required.";
    } else if (value.length > 16) {
      hostnameInput.parentElement.classList.add("error");
      errorEl.textContent = "Host Name must be 16 characters or fewer.";
    } else {
      hostnameInput.parentElement.classList.remove("error");
      errorEl.textContent = "";
    }
  });
};
//=================================================================================
// ✅ تابع عمومی اعتبارسنجی IPv4 برای تمام فیلدهای مشابه (4 بخش بین 0 تا 255)
function setupIPv4FieldValidation(fieldId, fieldLabel = "IPv4") {
  const ipInput = document.getElementById(fieldId);
  let errorEl = document.createElement("span");
  errorEl.className = "error-message";
  errorEl.style.display = "block";
  errorEl.style.marginBottom = "10px";
  ipInput.parentElement.insertAdjacentElement("afterend", errorEl);

  // جلوگیری از ورود کاراکتر غیر مجاز (فقط عدد و نقطه)
  ipInput.addEventListener("keydown", (e) => {
    if (!/[0-9.]/.test(e.key) && !["Backspace", "Tab", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
    }
  });

  // اعتبارسنجی فرمت IP
  ipInput.addEventListener("input", () => {
    const value = ipInput.value.trim();
    const parts = value.split(".");

    const valid = parts.length === 4 && parts.every(part => {
      const num = parseInt(part);
      return /^[0-9]+$/.test(part) && num >= 0 && num <= 255;
    });

    if (value === "") {
      ipInput.parentElement.classList.add("error");
      errorEl.textContent = `${fieldLabel} is required.`;
    } else if (!valid) {
      ipInput.parentElement.classList.add("error");
      errorEl.textContent = `${fieldLabel} must be 4 numbers between 0 and 255 (e.g., 192.168.1.1)`;
    } else {
      ipInput.parentElement.classList.remove("error");
      errorEl.textContent = "";
    }
  });
};
//=================================================================================
// ✅ اعتبارسنجی IPv6 در Access Point (فرمت استاندارد 8 بخش هگزادسیمال)
function setupAPIPv6Validation() {
  const ipInput = document.getElementById("ap-ipv6");
  let errorEl = document.createElement("span");
  errorEl.className = "error-message";
  errorEl.style.display = "block";
  errorEl.style.marginBottom = "10px";
  ipInput.parentElement.insertAdjacentElement("afterend", errorEl);

  // جلوگیری از ورود کاراکتر غیرمجاز
  ipInput.addEventListener("keydown", (e) => {
    if (!/[0-9a-fA-F:]/.test(e.key) && !["Backspace", "Tab", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
    }
  });

  ipInput.addEventListener("input", () => {
    const value = ipInput.value.trim();
    const parts = value.split(":");

    let valid = value !== "" &&
      parts.length === 8 &&
      parts.every(part => /^[0-9a-fA-F]{1,4}$/.test(part));

    if (value === "") {
      ipInput.parentElement.classList.add("error");
      errorEl.textContent = "IPv6 is required.";
    } else if (!valid) {
      ipInput.parentElement.classList.add("error");
      errorEl.textContent = "IPv6 must be 8 segments in hexadecimal (e.g., 2001:0db8:0000:0000:0000:0000:0000:0001)";
    } else {
      ipInput.parentElement.classList.remove("error");
      errorEl.textContent = "";
    }
  });
};
//=================================================================================
// // ✅ اعتبارسنجی Port (مقدار باید بین 0 تا 65535 و فقط عدد باشد)
function setupAPPortValidation() {
  const portInput = document.getElementById("ap-port");
  let errorEl = document.createElement("span");
  errorEl.className = "error-message";
  errorEl.style.display = "block";
  errorEl.style.marginBottom = "10px";
  portInput.parentElement.insertAdjacentElement("afterend", errorEl);

  // جلوگیری از ورود کاراکتر غیر عددی
  portInput.addEventListener("keydown", (e) => {
    if (!/[0-9]/.test(e.key) && e.key !== "Backspace" && e.key !== "ArrowLeft" && e.key !== "ArrowRight") {
      e.preventDefault();
    }
  });

  portInput.addEventListener("input", () => {
    const value = portInput.value.trim();
    const port = parseInt(value);

    if (value === "") {
      portInput.parentElement.classList.add("error");
      errorEl.textContent = "Port is required.";
    } else if (port < 0 || port > 65535) {
      portInput.parentElement.classList.add("error");
      errorEl.textContent = "Port must be between 0 and 65535.";
    } else {
      portInput.parentElement.classList.remove("error");
      errorEl.textContent = "";
    }
  });
};
//=================================================================================
// ✅ پاک کردن خطاهای فیلدهای Access Point هنگام باز شدن آکاردیون
function clearAccessPointValidationErrors() {
  const fields = [
    { id: "ap-ssid", err: "ap-ssid-error" },
    { id: "ap-preSharedKey", err: "ap-preSharedKey-error" },
    { id: "ap-hostname", err: "ap-hostname-error" },
    { id: "ap-port", err: "ap-port-error" },
    { id: "ap-ipv4", err: "ap-ipv4-error" },
    { id: "ap-ipv6", err: "ap-ipv6-error" },
    { id: "ap-gateway", err: "ap-gateway-error" },
    { id: "ap-subnet", err: "ap-subnet-error" },
    { id: "ap-dns1", err: "ap-dns1-error" },
    { id: "ap-dns2", err: "ap-dns2-error" },
  ];

  fields.forEach(({ id, err }) => {
    const input = document.getElementById(id);
    const errorEl = document.getElementById(err);
    if (input) input.parentElement.classList.remove("error");
    if (errorEl) errorEl.textContent = "";
  });
};
//=================================================================================
// ✅ پیام مربوط به خواندن ارسال و داده‌ها در فیلدهای مربوطه نمایش داده می‌شوند
function setupAccessPointAccordionListener() {
  clearAccessPointValidationErrors();
  centralManager.readApSettings((res) => {
    if (!res) return;

    if (res["AP SSID"]) document.getElementById("ap-ssid").value = res["AP SSID"];
    if (res["AP Pre-Shared Key"]) document.getElementById("ap-preSharedKey").value = res["AP Pre-Shared Key"];
    if (res["Ssid Hidden"] !== undefined) document.getElementById("ap-ssidHidden").checked = !!res["Ssid Hidden"];
    if (Array.isArray(res["AP IPv4"])) document.getElementById("ap-ipv4").value = formatIPv4(res["AP IPv4"]);
    if (Array.isArray(res["AP IPv6"])) document.getElementById("ap-ipv6").value = formatIPv6(res["AP IPv6"]);
    if (res["AP Port"]) document.getElementById("ap-port").value = res["AP Port"];
    if (res["AP HostName"]) document.getElementById("ap-hostname").value = res["AP HostName"];
    if (res["Wifi Channel"]) document.getElementById("ap-wifiChannel").value = res["Wifi Channel"];
    if (res["Max Connection"]) document.getElementById("ap-maxConnection").value = res["Max Connection"];
    if (Array.isArray(res["AP MAC"])) document.getElementById("ap-macaddress").value = formatMAC(res["AP MAC"]);
    if (Array.isArray(res["Gateway"])) document.getElementById("ap-gateway").value = formatIPv4(res["Gateway"]);
    if (Array.isArray(res["Subnet"])) document.getElementById("ap-subnet").value = formatIPv4(res["Subnet"]);
    if (Array.isArray(res["Primary DNS"])) document.getElementById("ap-dns1").value = formatIPv4(res["Primary DNS"]);
    if (Array.isArray(res["Secondary DNS"])) document.getElementById("ap-dns2").value = formatIPv4(res["Secondary DNS"]);
  });
};
//=================================================================================
// ✅ پیام مربوط به نوشتن ارسال و داده‌ها درون فیلدهای مربوطه در حافظه ذخیره می‌شوند 
function writeAccessPointSettings(callback = () => { }) {
  const ssidInput = document.getElementById("ap-ssid");
  const keyInput = document.getElementById("ap-preSharedKey");
  const hostnameInput = document.getElementById("ap-hostname");
  const portInput = document.getElementById("ap-port");

  const ssid = ssidInput.value.trim();
  const key = keyInput.value.trim();
  const hidden = document.getElementById("ap-ssidHidden").checked;
  const hostname = hostnameInput.value.trim();
  const port = parseInt(portInput.value.trim());
  const channel = document.getElementById("ap-wifiChannel").value;
  const maxConn = document.getElementById("ap-maxConnection").value;

  const ipv4 = parseIPv4String(document.getElementById("ap-ipv4").value);
  const ipv6 = parseIPv6String(document.getElementById("ap-ipv6").value);
  const gateway = parseIPv4String(document.getElementById("ap-gateway").value);
  const subnet = parseIPv4String(document.getElementById("ap-subnet").value);
  const dns1 = parseIPv4String(document.getElementById("ap-dns1").value);
  const dns2 = parseIPv4String(document.getElementById("ap-dns2").value);

  if (
    ssidInput.parentElement.classList.contains("error") ||
    keyInput.parentElement.classList.contains("error") ||
    hostnameInput.parentElement.classList.contains("error") ||
    portInput.parentElement.classList.contains("error")
  ) return;

  let payload = {
    "AP SSID": ssid,
    "AP Pre-Shared Key": key,
    "Ssid Hidden": hidden,
    "AP HostName": hostname,
    "AP Port": port,
    "Wifi Channel": channel,
    "Max Connection": maxConn
  };

  if (ipv4) payload["AP IPv4"] = ipv4;
  if (ipv6) payload["AP IPv6"] = ipv6;
  if (gateway) payload["Gateway"] = gateway;
  if (subnet) payload["Subnet"] = subnet;
  if (dns1) payload["Primary DNS"] = dns1;
  if (dns2) payload["Secondary DNS"] = dns2;

  centralManager.writeApSettings(payload, callback);
};
//=====================================================================================================
// ....................................... ✅ Station Part ...........................................
//=====================================================================================================
// ✅اعتبارسنجی SSID Modem
function setupStationSSIDValidation() {
  const ssidInput = document.getElementById("st-ssid");
  const errorEl = document.getElementById("st-ssid-error");

  ssidInput.addEventListener("input", () => {
    const value = ssidInput.value.trim();

    if (value.length === 0) {
      // خطا اگر فیلد خالی باشه
      ssidInput.parentElement.classList.add("error");
      errorEl.textContent = "SSID is required.";
    } else if (value.length > 32) {
      // خطا اگر بیشتر از ۳۲ کاراکتر باشد
      ssidInput.parentElement.classList.add("error");
      errorEl.textContent = "SSID must be 32 characters or fewer.";
    } else {
      // حذف خطا در صورت معتبر بودن
      ssidInput.parentElement.classList.remove("error");
      errorEl.textContent = "";
    }
  });
}
//=================================================================================
// ✅اعتبارسنجی PreSharedKey Modem
function setupStationPreSharedKeyValidation() {
  const keyInput = document.getElementById("st-key");
  const errorEl = document.getElementById("st-key-error");

  keyInput.addEventListener("input", () => {
    const value = keyInput.value.trim();

    if (value.length === 0) {
      keyInput.parentElement.classList.add("error");
      errorEl.textContent = "Password is required.";
    } else if (value.length < 1 || value.length > 64) {
      keyInput.parentElement.classList.add("error");
      errorEl.textContent = "Password must be between 1 and 64 characters.";
    } else {
      keyInput.parentElement.classList.remove("error");
      errorEl.textContent = "";
    }
  });
}
//=================================================================================
// ✅ اعتبارسنجی Hostname Modem
function setupStationHostnameValidation() {
  const hostnameInput = document.getElementById("st-hostname");
  const errorEl = document.getElementById("st-hostname-error");

  hostnameInput.addEventListener("input", () => {
    const value = hostnameInput.value.trim();

    if (value.length === 0) {
      hostnameInput.parentElement.classList.add("error");
      errorEl.textContent = "Host Name is required.";
    } else if (value.length > 16) {
      hostnameInput.parentElement.classList.add("error");
      errorEl.textContent = "Host Name must be 16 characters or fewer.";
    } else {
      hostnameInput.parentElement.classList.remove("error");
      errorEl.textContent = "";
    }
  });
};
//=================================================================================
// ✅ پاک کردن خطاهای فیلدهای بخش Station (SSID، Key، Hostname)
function clearStationValidationErrors() {
  const ssidInput = document.getElementById("st-ssid");
  const keyInput = document.getElementById("st-key");
  const hostInput = document.getElementById("st-hostname");

  const ssidError = document.getElementById("st-ssid-error");
  const keyError = document.getElementById("st-key-error");
  const hostError = document.getElementById("st-hostname-error");

  ssidInput.parentElement.classList.remove("error");
  keyInput.parentElement.classList.remove("error");
  hostInput.parentElement.classList.remove("error");

  ssidError.textContent = "";
  keyError.textContent = "";
  hostError.textContent = "";
};
//=================================================================================
// ✅ پیام مربوط به خواندن ارسال و داده‌ها در فیلدهای مربوطه نمایش داده می‌شوند
function setupStationAccordionListener() {
  clearStationValidationErrors();
  centralManager.readStationSettings((res) => {
    if (!res) return;

    if (res["Modem SSID"]) document.getElementById("st-ssid").value = res["Modem SSID"];
    if (res["Modem Pre-Shared Key"]) document.getElementById("st-key").value = res["Modem Pre-Shared Key"];
    if (res["STA HostName"]) document.getElementById("st-hostname").value = res["STA HostName"];
    if (Array.isArray(res["Modem IP"])) {
      document.getElementById("st-ip").value = res["Modem IP"].join(".");
    }
    if (Array.isArray(res["STA MAC"])) {
      document.getElementById("st-macaddress").value = formatMAC(res["STA MAC"]);
    }
    if (Array.isArray(res["Modem MAC"])) {
      document.getElementById("st-modemmac").value = formatMAC(res["Modem MAC"]);
    }
  });
};
//=================================================================================
// ✅ پیام مربوط به نوشتن ارسال و داده‌ها درون فیلدهای مربوطه در حافظه ذخیره می‌شوند 
function writeStationSettings(callback = () => { }) {
  const ssidInput = document.getElementById("st-ssid");
  const keyInput = document.getElementById("st-key");
  const hostnameInput = document.getElementById("st-hostname");

  const ssid = ssidInput.value.trim();
  const key = keyInput.value.trim();
  const hostname = hostnameInput.value.trim();

  if (
    ssidInput.parentElement.classList.contains("error") ||
    keyInput.parentElement.classList.contains("error") ||
    hostnameInput.parentElement.classList.contains("error")
  ) return;

  centralManager.writeStationSettings({
    "Modem SSID": ssid,
    "Modem Pre-Shared Key": key,
    "STA HostName": hostname
  }, callback);
};
//=====================================================================================================
// ....................................... ✅ Security Part ..........................................
//=====================================================================================================
// ✅ اعتبارسنجی Username
function setupSecurityUsernameValidation() {
  const userInput = document.getElementById("sec-username");
  const errorEl = document.getElementById("sec-username-error");

  userInput.addEventListener("input", () => {
    const value = userInput.value.trim();

    if (value.length === 0) {
      userInput.parentElement.classList.add("error");
      errorEl.textContent = "Username is required.";
    } else if (value.length > 16) {
      userInput.parentElement.classList.add("error");
      errorEl.textContent = "Username must be 16 characters or fewer.";
    } else {
      userInput.parentElement.classList.remove("error");
      errorEl.textContent = "";
    }
  });
};
//=================================================================================
// ✅ اعتبارسنجی Password
function setupSecurityPasswordValidation() {
  const passInput = document.getElementById("sec-password");
  const errorEl = document.getElementById("sec-password-error");

  passInput.addEventListener("input", () => {
    const value = passInput.value.trim();

    if (value.length === 0) {
      passInput.parentElement.classList.add("error");
      errorEl.textContent = "Password is required.";
    } else if (value.length > 16) {
      passInput.parentElement.classList.add("error");
      errorEl.textContent = "Password must be 16 characters or fewer.";
    } else {
      passInput.parentElement.classList.remove("error");
      errorEl.textContent = "";
    }
  });
};
//=================================================================================
// ✅ خالی کردن پیام‌های خطا (متن‌های قرمز زیر فیلدها)
function clearSecurityValidationErrors() {
  const userInput = document.getElementById("sec-username");
  const passInput = document.getElementById("sec-password");
  const userError = document.getElementById("sec-username-error");
  const passError = document.getElementById("sec-password-error");

  userInput.parentElement.classList.remove("error");
  passInput.parentElement.classList.remove("error");
  userError.textContent = "";
  passError.textContent = "";
};
//=================================================================================
// ✅ پیام مربوط به خواندن ارسال و داده‌ها در فیلدهای مربوطه نمایش داده می‌شوند
function setupSecurityAccordionListener() {
  clearSecurityValidationErrors();
  centralManager.readSecuritySettings((res) => {
    if (!res) return;

    if (res["username"]) document.getElementById("sec-username").value = res["username"];
    if (res["password"]) document.getElementById("sec-password").value = res["password"];
  });
};
//=================================================================================
// ✅ پیام مربوط به نوشتن ارسال و داده‌ها درون فیلدهای مربوطه در حافظه ذخیره می‌شوند 
function writeSecuritySettings(callback = () => { }) {
  const userInput = document.getElementById("sec-username");
  const passInput = document.getElementById("sec-password");

  const user = userInput.value.trim();
  const pass = passInput.value.trim();

  if (userInput.parentElement.classList.contains("error") || passInput.parentElement.classList.contains("error")) return;

  centralManager.writeSecuritySettings({ username: user, password: pass }, callback);
};
//=====================================================================================================
// ..................................... ✅ Reset Factory Part ........................................
//=====================================================================================================
// ✅ تابع مدیریت دکمه ریست فکتوری و ارسال پیام‌ها
function setupResetFactoryButton() {
  const resetCircle = document.getElementById("reset-circle");
  const resetNumber = document.getElementById("reset-number");
  const resetBar = document.querySelector(".reset-bar");

  let countdown = 7;
  let interval = null;
  const totalLength = 314; // محیط دایره = 2πr ≈ 2 * 3.14 * 50

  if (!resetCircle || !resetNumber || !resetBar) return;

  resetCircle.addEventListener("click", () => {
    if (interval) return; // جلوگیری از چند بار کلیک

    countdown = 7;
    resetNumber.textContent = countdown;
    resetBar.style.strokeDashoffset = "0";

    interval = setInterval(() => {
      countdown--;
      resetNumber.textContent = countdown;

      const progress = countdown / 7; // درصد باقی‌مانده
      resetBar.style.strokeDashoffset = totalLength * (1 - progress);

      if (countdown <= 0) {
        clearInterval(interval);
        interval = null;

        // 1️⃣ ارسال پیام Reset Factory
        centralManager.sendRaw({
          setting: "command",
          action: "push button",
          fields: { "Reset factory": true }
        });

        // 2️⃣ ارسال پیام Config
        centralManager.sendRaw({
          setting: "command",
          action: "push button",
          fields: { "Config": true }
        });

        // 3️⃣ رفتن به صفحه لاگین
        setTimeout(() => {
          window.location.href = "index.html";
        }, 3000);
      }
    }, 1000);
  });
};
//=====================================================================================================
// ............................... 🚀 اجرای توابع هنگام لود صفحه ...................................
//=====================================================================================================
window.addEventListener("DOMContentLoaded", () => {
  centralManager.initWebSocket({
    onOpen: () => {
      setupAccessPointAccordionListener();
    },
    onError: () => { },
    onClose: () => { }
  });

  // ✅ اجرای تمام توابع مربوط به فرم و اعتبارسنجی
  setupAPSSIDValidation();
  setupAPPreSharedKeyValidation();
  setupAPHostnameValidation();
  setupIPModeSwitch();
  setupIPv4FieldValidation("ap-ipv4", "IPv4");
  setupAPIPv6Validation();
  setupAPPortValidation();
  setupIPv4FieldValidation("ap-gateway", "Gateway");
  setupIPv4FieldValidation("ap-subnet", "Subnet");
  setupIPv4FieldValidation("ap-dns1", "Primary DNS");
  setupIPv4FieldValidation("ap-dns2", "Secondary DNS");
  setupStationSSIDValidation();
  setupStationPreSharedKeyValidation();
  setupStationHostnameValidation();
  setupSecurityUsernameValidation();
  setupSecurityPasswordValidation();

  setupBackButton();
  enableSwipeBack("dashboard.html");
  setupResetFactoryButton();
});
//=====================================================================================================
// ابتدا write آکاردیون قبلی
function handlePreviousSectionWrite() {
  if (lastOpenedSection === "section-ap") {
    writeAccessPointSettings();
  } else if (lastOpenedSection === "section-station") {
    writeStationSettings();
  } else if (lastOpenedSection === "section-security") {
    writeSecuritySettings();
  }
};
//=====================================================================================================
// ✅ زمانی که روی هر آکاردیون کلیک می‌شود، ابتدا همه آکاردیون‌ها بسته می‌شوند
// سپس فقط آکاردیون انتخاب‌شده باز شده و پیام خواندن مناسب برای آن بخش ارسال می‌گردد
//=====================================================================================================
dropdownButtons.forEach(button => {
  button.addEventListener("click", () => {
    const parentContainer = button.parentElement;
    const isActive = parentContainer.classList.contains("active");
    const openCount = document.querySelectorAll(".dropdown-container.active").length;

    if (isActive && openCount === 1) return;

    // 1️⃣ قبل از تغییر: ذخیره تنظیمات آکاردیون قبلی
    handlePreviousSectionWrite();

    // 2️⃣ بستن همه آکاردیون‌ها
    document.querySelectorAll(".dropdown-container.active").forEach(el => el.classList.remove("active"));

    // 3️⃣ باز کردن آکاردیون جدید
    parentContainer.classList.add("active");

    // 4️⃣ ارسال پیام read برای آکاردیون جدید
    if (parentContainer.id === "section-ap") {
      setupAccessPointAccordionListener();
    } else if (parentContainer.id === "section-station") {
      setupStationAccordionListener();
    } else if (parentContainer.id === "section-security") {
      setupSecurityAccordionListener();
    }

    // 5️⃣ در انتها به‌روزرسانی آکاردیون فعال
    lastOpenedSection = parentContainer.id;
  });
});
//=====================================================================================================
//=====================================================================================================
//=====================================================================================================