"use strict";

const STORE_KEY = "ui_objects_v1";

// IMPORTANT: if your UI filename is different, change it here:
const USER_INTERFACE_PAGE = "userInterface.html";

// Your ScanBand page file:
const SCANBAND_PAGE = "remuteScan.html";

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function loadItems() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); }
  catch { return []; }
}

function saveItems(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

function stateFromTag(tag) {
  const t = String(tag || "").toLowerCase();
  if (t === "ready") return "good";
  if (t === "new") return "warn";
  if (t === "offline") return "bad";
  return "good";
}

function buildSub({ type, frequency, modulation, bitCount, code, delay }) {
  const parts = [];
  if (type) parts.push(`Type: ${type}`);
  if (frequency) parts.push(`Freq: ${frequency} MHz`);
  if (modulation) parts.push(`Mod: ${modulation}`);
  if (bitCount) parts.push(`Bits: ${bitCount}`);
  if (code) parts.push(`Code: ${code}`);
  if (delay) parts.push(`Delay: ${delay} ms`);
  return parts.join(" • ");
}

function initDropdown(ddId, hiddenInputId, valueSpanId, onChange) {
  const dd = document.getElementById(ddId);
  const btn = dd.querySelector(".dd-btn");
  const menu = dd.querySelector(".dd-menu");
  const opts = Array.from(dd.querySelectorAll(".dd-opt"));
  const hidden = document.getElementById(hiddenInputId);
  const valueSpan = document.getElementById(valueSpanId);

  function setValue(v) {
    hidden.value = v;
    valueSpan.textContent = v;
    dd.dataset.value = v;

    opts.forEach(o => o.classList.toggle("active", o.dataset.value === v));
    if (typeof onChange === "function") onChange(v);
  }

  function closeAll() {
    document.querySelectorAll(".dd.open").forEach(x => {
      x.classList.remove("open");
      const b = x.querySelector(".dd-btn");
      if (b) b.setAttribute("aria-expanded", "false");
    });
  }

  function open() {
    dd.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    menu.focus({ preventScroll: true });
  }

  function close() {
    dd.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const isOpen = dd.classList.contains("open");
    closeAll();
    if (!isOpen) open();
    else close();
  });

  opts.forEach(o => {
    o.addEventListener("click", () => {
      setValue(o.dataset.value);
      close();
    });
  });

  document.addEventListener("click", (e) => {
    if (!dd.contains(e.target)) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  setValue(hidden.value || dd.dataset.value || opts[0]?.dataset.value || "");
  return { setValue, close };
}

function main() {
  const btnBack = document.getElementById("btnBack");
  const form = document.getElementById("form");
  const btnSave = document.getElementById("btnSave");

  const name = document.getElementById("name");
  const type = document.getElementById("type");
  const tag  = document.getElementById("tag");

  const frequency = document.getElementById("frequency");
  const modulation = document.getElementById("modulation");
  const bitCount = document.getElementById("bitCount");
  const code = document.getElementById("code");
  const delay = document.getElementById("delay");

  // Back: always works
  btnBack.addEventListener("click", () => {
    if (history.length > 1) {
      history.back();
      return;
    }
    window.location.href = USER_INTERFACE_PAGE;
  });

  // Dropdowns
  initDropdown("ddType", "type", "typeValue");
  initDropdown("ddTag", "tag", "tagValue");
  initDropdown("ddMod", "modulation", "modValue");

  initDropdown("ddSetup", "setupMethod", "setupValue", (v) => {
    if (v === "ScanBand") {
      sessionStorage.setItem("addDevice_setupMethod", "ScanBand");
      window.location.href = SCANBAND_PAGE;
    }
  });

  // Validation: Save only when all required fields are filled
  const isFilled = (el) => el.value.trim().length > 0;

  const validate = () => {
    const ok =
      name.value.trim().length >= 2 &&
      isFilled(frequency) &&
      isFilled(bitCount) &&
      isFilled(code) &&
      isFilled(delay);

    btnSave.disabled = !ok;
  };

  ["input", "change"].forEach(ev => {
    name.addEventListener(ev, validate);
    frequency.addEventListener(ev, validate);
    bitCount.addEventListener(ev, validate);
    code.addEventListener(ev, validate);
    delay.addEventListener(ev, validate);
  });

  validate();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    validate();
    if (btnSave.disabled) return;

    const item = {
      id: crypto.randomUUID(),
      name: name.value.trim(),
      sub: buildSub({
        type: type.value,
        frequency: frequency.value.trim(),
        modulation: modulation.value,
        bitCount: bitCount.value.trim(),
        code: code.value.trim(),
        delay: delay.value.trim()
      }),
      time: nowTime(),
      tag: tag.value,
      state: stateFromTag(tag.value)
    };

    const all = loadItems();
    all.unshift(item);
    saveItems(all);

    window.location.href = USER_INTERFACE_PAGE;
  });
}

document.addEventListener("DOMContentLoaded", main);
