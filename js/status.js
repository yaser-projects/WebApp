// نمایش جدول DHCP و مدیریت دکمه‌ها و Swipe برگشت

function loadStatusClients() {
  const table = document.getElementById("dhcp-table").getElementsByTagName("tbody")[0];
  table.innerHTML = `<tr>
    <td colspan="4" style="text-align:center; color:#0ff;">Loading...</td>
  </tr>`;

  centralManager.readStatusClients(function (res) {
    // ===> کلید درست اینه:
    let clients = res["Scan Active Clients"] || [];
    let count = parseInt(res["AP Station Num"] || clients.length || 0);

    document.getElementById("device-count").textContent = count;

    if (!Array.isArray(clients) || clients.length === 0) {
      table.innerHTML = `<tr>
        <td colspan="4" style="text-align:center; color:#fa0;">No devices connected</td>
      </tr>`;
      return;
    }

    table.innerHTML = clients.map(arr =>
      `<tr>
        <td>${arr[0] || "-"}</td>
        <td>${arr[1] || "-"}</td>
        <td>${arr[2] || "-"}</td>
        <td>${res["AP HostName"] || "-"}</td>
      </tr>`
    ).join('');
  });
}


document.addEventListener("DOMContentLoaded", function () {
  // حتماً اول WebSocket را اینیش کن و بعد بارگذاری جدول رو به onOpen بسپار!
  centralManager.initWebSocket({
    onOpen: function () {
      loadStatusClients();
    }
  });

  // دکمه Back
  var backBtn = document.getElementById("status-back");
  if (backBtn) {
    backBtn.onclick = function () {
      window.location.href = "dashboard.html";
    };
  }

  // دکمه Refresh
  var refreshBtn = document.getElementById("status-refresh");
  if (refreshBtn) {
    refreshBtn.onclick = function () {
      loadStatusClients();
    };
  }
});

document.addEventListener('DOMContentLoaded', () => {
  if (typeof centralManager?.enableSwipeBack === 'function') {
    centralManager.enableSwipeBack("dashboard.html");
  }
});