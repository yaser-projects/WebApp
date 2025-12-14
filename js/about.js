"use strict";

/**
 * About page WebSocket:
 * On load (and Update click) send:
 * {
 *   "setting": "device",
 *   "action": "read",
 *   "fields": ["Device Info"]
 * }
 *
 * Expected response example:
 * {"Device Info":["Metal Brain","Praid","ES 131","MB-WBSR-V1.0","2025/06","9215951354","1.0"]}
 */

const WS_PATH = "/ws";
const READ_MSG = {
  setting: "device",
  action: "read",
  fields: ["Device Info"],
};

const el = {
  manufacturer: document.getElementById("vManufacturer"),
  deviceName: document.getElementById("vDeviceName"),
  modelNumber: document.getElementById("vModelNumber"),
  deviceModel: document.getElementById("vDeviceModel"),
  productionDate: document.getElementById("vProductionDate"),
  serialNumber: document.getElementById("vSerialNumber"),
  firmwareVersion: document.getElementById("vFirmwareVersion"),
  readState: document.getElementById("readState"),
  btnUpdate: document.getElementById("btnUpdate"),
};

let ws = null;
let reconnectTimer = null;

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss://" : "ws://";
  return proto + location.host + WS_PATH;
}

function setReading(text) {
  el.readState.textContent = text;
}

function setPlaceholders() {
  el.manufacturer.textContent = "-";
  el.deviceName.textContent = "-";
  el.modelNumber.textContent = "-";
  el.deviceModel.textContent = "-";
  el.productionDate.textContent = "-";
  el.serialNumber.textContent = "-";
  el.firmwareVersion.textContent = "-";
}

function applyDeviceInfo(arr) {
  // Mapping:
  // [0]=Manufacturer, [1]=Device Name, [2]=Model Number,
  // [3]=Device Model, [4]=Production Date, [5]=Serial Number, [6]=Firmware Version
  el.manufacturer.textContent = arr[0] ?? "-";
  el.deviceName.textContent = arr[1] ?? "-";
  el.modelNumber.textContent = arr[2] ?? "-";
  el.deviceModel.textContent = arr[3] ?? "-";
  el.productionDate.textContent = arr[4] ?? "-";
  el.serialNumber.textContent = arr[5] ?? "-";
  el.firmwareVersion.textContent = arr[6] ?? "-";
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function sendRead() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    setReading("Disconnected");
    return;
  }
  setReading("Reading device info...");
  ws.send(JSON.stringify(READ_MSG));
}

function connect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  try {
    ws = new WebSocket(wsUrl());
  } catch {
    setReading("Disconnected");
    return;
  }

  ws.addEventListener("open", () => {
    sendRead();
  });

  ws.addEventListener("message", (ev) => {
    const obj = safeJsonParse(ev.data);
    if (!obj) return;

    const info = obj["Device Info"];
    if (Array.isArray(info) && info.length >= 7) {
      applyDeviceInfo(info);
      setReading("Device info updated.");
    }
  });

  ws.addEventListener("close", () => {
    setReading("Disconnected");
    reconnectTimer = setTimeout(connect, 1200);
  });

  ws.addEventListener("error", () => {
    setReading("Disconnected");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setPlaceholders();
  setReading("Reading device info...");
  connect();

  el.btnUpdate.addEventListener("click", () => {
    sendRead();
  });
});
