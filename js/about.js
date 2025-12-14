"use strict";

import { connectWebSocket } from "./ws.js";

/**
 * مسیرها (اگر اسم فایل/مسیر پروژه‌ات فرق دارد فقط همین دو خط را عوض کن)
 * - backTo: صفحه داشبورد/یوزراینترفیس
 * - updatePage: صفحه آپدیت ESP32
 */
const ROUTES = {
  backTo: "userInterface.html",  // پیشنهاد بر اساس ساختار پروژه‌های قبلی
  updatePage: "update"           // صفحه OTA/Update
};

const el = {
  btnBack: document.getElementById("btnBack"),
  btnUpdate: document.getElementById("btnUpdate"),
  manufacturer: document.getElementById("vManufacturer"),
  deviceName: document.getElementById("vDeviceName"),
  modelNumber: document.getElementById("vModelNumber"),
  deviceModel: document.getElementById("vDeviceModel"),
  productionDate: document.getElementById("vProductionDate"),
  serialNumber: document.getElementById("vSerialNumber"),
  firmwareVersion: document.getElementById("vFirmwareVersion"),
  readState: document.getElementById("readState"),
};

let ws = null;

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
  el.manufacturer.textContent = arr?.[0] ?? "-";
  el.deviceName.textContent = arr?.[1] ?? "-";
  el.modelNumber.textContent = arr?.[2] ?? "-";
  el.deviceModel.textContent = arr?.[3] ?? "-";
  el.productionDate.textContent = arr?.[4] ?? "-";
  el.serialNumber.textContent = arr?.[5] ?? "-";
  el.firmwareVersion.textContent = arr?.[6] ?? "-";
}

function requestRead() {
  if (!ws?.isConnected) {
    setReading("Disconnected");
    return;
  }
  setReading("Reading device info...");
  ws.deviceInfoRead(); // ✅ پیام فقط داخل ws.js
}

document.addEventListener("DOMContentLoaded", () => {
  setPlaceholders();
  setReading("Connecting...");

  // Back -> User Interface
  el.btnBack.addEventListener("click", () => {
    window.location.href = ROUTES.backTo;
  });

  // Update -> Update HTML (ESP32)
  el.btnUpdate.addEventListener("click", () => {
    window.location.href = ROUTES.updatePage;
  });

  // WebSocket (برای خواندن اطلاعات)
  ws = connectWebSocket({
    onOpen: () => requestRead(),
    onClose: () => setReading("Disconnected"),
    onError: () => setReading("Disconnected"),
  });

  window.addEventListener("device:info", (e) => {
    const info = e?.detail?.info;
    if (Array.isArray(info)) {
      applyDeviceInfo(info);
      setReading("Device info updated.");
    }
  });
});
