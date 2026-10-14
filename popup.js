"use strict";

const $ = (id) => document.getElementById(id);
const PRESETS = [
  ["#2a0f4a", "#06303a"], ["#0f2027", "#2c5364"], ["#3a0d0d", "#0d0d0d"],
  ["#11998e", "#0b3d2e"], ["#41295a", "#2f0743"], ["#1f1c2c", "#928dab"]
];

let state = { ...AXBG_DEFAULTS };
let saveTimer = null;

function save(patch, debounce = false) {
  Object.assign(state, patch);
  clearTimeout(saveTimer);
  if (debounce) saveTimer = setTimeout(() => chrome.storage.local.set(patch), 60);
  else chrome.storage.local.set(patch);
}

function render() {
  $("enabled").checked = state.enabled;
  document.querySelectorAll("#mode button").forEach((b) => b.classList.toggle("active", b.dataset.mode === state.mode));
  document.querySelectorAll(".pane").forEach((p) => p.classList.toggle("active", p.dataset.pane === state.mode));
  for (const id of ["color", "grad1", "grad2", "gradAngle", "imageUrl", "imageFit", "imagePos", "opacity", "blur", "dim"]) {
    if (document.activeElement !== $(id)) $(id).value = state[id];
  }
  $("clearInner").checked = state.clearInner;
  $("gradAngleV").textContent = state.gradAngle + "°";
  $("opacityV").textContent = state.opacity + "%";
  $("blurV").textContent = state.blur + "px";
  $("dimV").textContent = state.dim + "%";
  const src = state.imageData || state.imageUrl;
  $("thumb").src = src || "";
  $("thumb").classList.toggle("show", !!src);
  $("selectorView").textContent = state.selector ? "Вручную: " + state.selector : "";
}

// ---------- статус вкладки ----------

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(msg) {
  const tab = await activeTab();
  if (!tab?.id) return null;
  try { return await chrome.tabs.sendMessage(tab.id, msg); } catch { return null; }
}

async function refreshStatus() {
  const el = $("status");
  const res = await send({ type: "axbg-status" });
  if (!res) {
    el.className = "status warn";
    el.textContent = "Открой axiom.trade в этой вкладке (если уже открыт — обнови страницу).";
    return;
  }
  if (!state.enabled) { el.className = "status"; el.textContent = "Выключено."; return; }
  if (res.found) {
    el.className = "status ok";
    el.textContent = res.manual ? "Панель найдена (выбрана вручную)." : "Панель Instant Trade найдена.";
  } else {
    el.className = "status warn";
    el.textContent = "Панель не найдена. Открой Instant Trade или укажи её вручную.";
  }
}

// ---------- события ----------

$("enabled").addEventListener("change", (e) => { save({ enabled: e.target.checked }); setTimeout(refreshStatus, 300); });

document.querySelectorAll("#mode button").forEach((b) =>
  b.addEventListener("click", () => { save({ mode: b.dataset.mode }); render(); })
);

for (const id of ["color", "grad1", "grad2"]) {
  $(id).addEventListener("input", (e) => { save({ [id]: e.target.value }, true); });
}
for (const id of ["gradAngle", "opacity", "blur", "dim"]) {
  $(id).addEventListener("input", (e) => { save({ [id]: Number(e.target.value) }, true); render(); });
}
for (const id of ["imageFit", "imagePos"]) {
  $(id).addEventListener("change", (e) => save({ [id]: e.target.value }));
}
$("imageUrl").addEventListener("change", (e) => { save({ imageUrl: e.target.value.trim(), imageData: "" }); render(); });
$("clearInner").addEventListener("change", (e) => save({ clearInner: e.target.checked }));

$("file").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 15 * 1024 * 1024) { alert("Файл больше 15 МБ — возьми картинку поменьше."); return; }
  const r = new FileReader();
  r.onload = () => { save({ imageData: r.result, imageUrl: "", mode: "image" }); render(); };
  r.readAsDataURL(f);
});
$("clearImage").addEventListener("click", () => { save({ imageData: "", imageUrl: "" }); $("file").value = ""; render(); });

$("openTab").addEventListener("click", (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });

$("pick").addEventListener("click", async () => {
  const res = await send({ type: "axbg-pick" });
  if (res) window.close();
  else refreshStatus();
});
$("autoFind").addEventListener("click", () => { save({ selector: "" }); render(); setTimeout(refreshStatus, 300); });

$("reset").addEventListener("click", () => {
  chrome.storage.local.clear(() => { state = { ...AXBG_DEFAULTS }; $("file").value = ""; render(); setTimeout(refreshStatus, 300); });
});

// пресеты градиентов
for (const [a, b] of PRESETS) {
  const btn = document.createElement("button");
  btn.style.background = `linear-gradient(135deg, ${a}, ${b})`;
  btn.title = `${a} → ${b}`;
  btn.addEventListener("click", () => { save({ grad1: a, grad2: b, mode: "gradient" }); render(); });
  $("presets").appendChild(btn);
}

// если открыто как отдельная вкладка — подсказка про файл не нужна, статуса вкладки тоже нет
const isTab = location.search.includes("tab") || window.innerWidth > 500;
if (isTab) { $("fileNote").style.display = "none"; }

chrome.storage.local.get(AXBG_DEFAULTS, (s) => {
  state = { ...AXBG_DEFAULTS, ...s };
  render();
  if (isTab) { $("status").textContent = "Настройки применяются сразу на всех открытых вкладках Axiom."; }
  else refreshStatus();
});
