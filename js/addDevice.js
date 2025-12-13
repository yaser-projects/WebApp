const STORE_KEY = "mb_devices_v1";

function loadDevices() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); }
  catch { return []; }
}
function saveDevices(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function main() {
  const backBtn = document.getElementById("backBtn");
  const form = document.getElementById("form");
  const name = document.getElementById("name");
  const type = document.getElementById("type");
  const freq = document.getElementById("freq");
  const note = document.getElementById("note");
  const tag = document.getElementById("tag");
  const saveBtn = document.getElementById("saveBtn");

  const validate = () => {
    saveBtn.disabled = name.value.trim().length < 2;
  };
  name.addEventListener("input", validate);
  validate();

  backBtn.addEventListener("click", () => history.back());

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const device = {
      id: crypto.randomUUID(),
      name: name.value.trim(),
      last: `Type: ${type.value}${freq.value ? " • " + freq.value : ""}${note.value ? " • " + note.value : ""}`,
      time: nowTime(),
      state: "good",
      tag: tag.value || "Ready"
    };

    const all = loadDevices();
    all.unshift(device);
    saveDevices(all);

    window.location.href = "userInterface.html";
  });
}

document.addEventListener("DOMContentLoaded", main);
