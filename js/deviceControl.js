(function initDeviceControl(){
  const params = new URLSearchParams(window.location.search);

  // اسم دستگاه از querystring
  const name = params.get("name") || "Sample name";

  // مسیر داشبورد:
  // اگر خواستی از بیرون تعیینش کنی: ?back=dashboard/index.html
  const DASHBOARD_URL = params.get("back") || "dashboard.html";

  const deviceTitleEl = document.getElementById("deviceTitle");
  const deviceNameTextEl = document.getElementById("deviceNameText");
  const backEl = document.getElementById("btnBack");

  deviceTitleEl.textContent = `Remote Control — ${name}`;
  deviceNameTextEl.textContent = name;

  // Back همیشه بره داشبورد
  backEl.addEventListener("click", () => {
    window.location.assign(DASHBOARD_URL);
  });

  // دکمه‌ها
  document.querySelectorAll(".rbtn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const key = btn.dataset.key;

      // Ripple
      const r = document.createElement("span");
      r.className = "ripple";
      const rect = btn.getBoundingClientRect();
      r.style.left = (e.clientX - rect.left) + "px";
      r.style.top  = (e.clientY - rect.top) + "px";
      btn.appendChild(r);
      setTimeout(() => r.remove(), 600);

      // TODO: اینجا ارسال فرمان واقعی به ESP32
      console.log("Remote key pressed:", { device: name, key });
    });
  });
})();
