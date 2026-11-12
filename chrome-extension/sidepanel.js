// --- Storage ---
const DEFAULTS = { apiUrl: "http://localhost:8080/api/translate", username: "admin", password: "password123", darkMode: false, autoTranslate: false };
const load = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const loadSettings = () => load("d_settings", { ...DEFAULTS });
const saveSettingsData = s => save("d_settings", s);
const getAuth = () => { const s = loadSettings(); return "Basic " + btoa(s.username + ":" + s.password); };
const getApiUrl = () => loadSettings().apiUrl;

const loadHistory = () => load("d_history", []);
const pushHistory = e => { const h = loadHistory(); h.unshift(e); if (h.length > 100) h.length = 100; save("d_history", h); };
const clearHistoryData = () => save("d_history", []);

const loadFavorites = () => load("d_favorites", []);
const addFavorite = e => { const f = loadFavorites(); f.unshift({ ...e, savedAt: new Date().toLocaleString() }); save("d_favorites", f); };
const removeFavorite = i => { const f = loadFavorites(); f.splice(i, 1); save("d_favorites", f); };

// --- DOM ---
const $ = id => document.getElementById(id);
const inputEl = $("input"), output = $("output"), translateBtn = $("translateBtn");
const speakBtn = $("speakBtn"), copyBtn = $("copyBtn"), favBtn = $("favBtn");
const statusEl = $("status");
const translitToggle = $("translitToggle"), translitOutput = $("translitOutput");
const detectedLangEl = $("detectedLang"), detectedLangText = $("detectedLangText");
const resultArea = $("resultArea"), loadingSkeleton = $("loadingSkeleton");
const charCount = $("charCount");

let lastResult = null;
let sourceLangVal = "auto", targetLangVal = "Darija";

// --- Toast ---
let toastTimer = null;
function showToast(msg, type) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast" + (type === "green" ? " green" : "");
  void t.offsetWidth;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// --- Custom select dropdowns ---
function initSelect(wrapId, btnId, menuId, onSelect) {
  const btn = $(btnId), menu = $(menuId);
  btn.addEventListener("click", e => {
    e.stopPropagation();
    document.querySelectorAll(".select-menu.open").forEach(m => { if (m !== menu) m.classList.remove("open"); });
    document.querySelectorAll(".select-btn.open").forEach(b => { if (b !== btn) b.classList.remove("open"); });
    menu.classList.toggle("open");
    btn.classList.toggle("open");
  });
  menu.querySelectorAll(".select-opt").forEach(opt => {
    opt.addEventListener("click", () => {
      menu.querySelectorAll(".select-opt").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      btn.textContent = opt.textContent;
      menu.classList.remove("open");
      btn.classList.remove("open");
      onSelect(opt.dataset.value);
    });
  });
}
document.addEventListener("click", () => {
  document.querySelectorAll(".select-menu.open").forEach(m => m.classList.remove("open"));
  document.querySelectorAll(".select-btn.open").forEach(b => b.classList.remove("open"));
});

initSelect("sourceLangWrap", "sourceLangBtn", "sourceLangMenu", v => { sourceLangVal = v; });
initSelect("targetLangWrap", "targetLangBtn", "targetLangMenu", v => { targetLangVal = v; });

// --- Auto-resize textarea ---
function autoResize() {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 180) + "px";
}
inputEl.addEventListener("input", () => { autoResize(); charCount.textContent = inputEl.value.length; });

// --- Tabs ---
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    $("tab-" + tab.dataset.tab).classList.add("active");
    if (tab.dataset.tab === "history") renderHistory();
    if (tab.dataset.tab === "favorites") renderFavorites();
  });
});

// --- Dark mode ---
function applyDark(on) { document.documentElement.classList.toggle("dark", on); }
(function() {
  const s = loadSettings();
  applyDark(s.darkMode);
  $("darkModeToggle").checked = s.darkMode;
})();
$("darkToggle").addEventListener("click", () => {
  const s = loadSettings(); s.darkMode = !s.darkMode; saveSettingsData(s);
  applyDark(s.darkMode); $("darkModeToggle").checked = s.darkMode;
});
$("darkModeToggle").addEventListener("change", e => {
  const s = loadSettings(); s.darkMode = e.target.checked; saveSettingsData(s); applyDark(s.darkMode);
});

// --- Connection check ---
async function checkConnection() {
  const dot = $("statusDot");
  try {
    const url = getApiUrl().replace(/\/translate$/, "/translate/health");
    const res = await fetch(url, { headers: { Authorization: getAuth() }, signal: AbortSignal.timeout(4000) });
    dot.className = res.ok ? "dot dot-ok" : "dot dot-err";
  } catch { dot.className = "dot dot-err"; }
}
checkConnection();
setInterval(checkConnection, 30000);

// --- Settings ---
(function() {
  const s = loadSettings();
  $("settingsUrl").value = s.apiUrl; $("settingsUser").value = s.username; $("settingsPass").value = s.password;
  $("autoTranslateToggle").checked = s.autoTranslate || false;
})();
$("saveSettingsBtn").addEventListener("click", () => {
  saveSettingsData({
    apiUrl: $("settingsUrl").value.trim(), username: $("settingsUser").value.trim(),
    password: $("settingsPass").value, autoTranslate: $("autoTranslateToggle").checked,
    darkMode: $("darkModeToggle").checked,
  });
  showToast("Settings saved", "green");
  checkConnection();
});

// --- Background messages ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "translate" && msg.text) {
    document.querySelectorAll(".tab")[0].click();
    inputEl.value = msg.text; autoResize(); charCount.textContent = msg.text.length;
    doTranslate();
  }
  if (msg.action === "selection" && msg.text && loadSettings().autoTranslate) {
    document.querySelectorAll(".tab")[0].click();
    inputEl.value = msg.text; autoResize(); charCount.textContent = msg.text.length;
    doTranslate();
  }
  if (msg.action === "batchTranslate" && msg.texts) {
    fetch(getApiUrl() + "/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: getAuth() },
      body: JSON.stringify({ texts: msg.texts, sourceLang: "auto", targetLang: targetLangVal, transliterate: false }),
    })
    .then(r => r.json())
    .then(data => {
      if (Array.isArray(data)) sendResponse({ translations: data.map(d => d.translation || d) });
      else sendResponse({ translations: msg.texts });
    })
    .catch(() => sendResponse({ translations: msg.texts }));
    return true;
  }
  if (msg.action === "pageTranslateDone") {
    pageTranslateActive = true;
    $("translatePageBtn").classList.add("restoring");
    showToast("Page translated!", "green");
  }
});

// --- Translate Page (injects content script on demand) ---
let pageTranslateActive = false;

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: "ping" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await new Promise(r => setTimeout(r, 100));
  }
}

$("translatePageBtn").addEventListener("click", async () => {
  const btn = $("translatePageBtn");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) { showToast("No active tab", ""); return; }

  if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://") || tab.url?.startsWith("about:")) {
    showToast("Can't translate browser pages", ""); return;
  }

  btn.disabled = true;

  try {
    await ensureContentScript(tab.id);

    if (!pageTranslateActive) showToast("Translating page...", "green");

    const res = await chrome.tabs.sendMessage(tab.id, { action: "translatePage" });
    if (res?.status === "restored") {
      pageTranslateActive = false;
      btn.classList.remove("restoring");
      showToast("Page restored", "");
    } else if (res?.status === "empty") {
      showToast("No translatable text found", "");
    }
  } catch (e) {
    showToast("Could not translate page — try refreshing", "");
  } finally {
    btn.disabled = false;
  }
});

// --- Translate ---
translateBtn.addEventListener("click", doTranslate);
inputEl.addEventListener("keydown", e => { if (e.key === "Enter" && e.ctrlKey) doTranslate(); });

async function doTranslate() {
  const text = inputEl.value.trim();
  if (!text) return;

  translateBtn.disabled = true;
  resultArea.style.display = "none";
  loadingSkeleton.style.display = "block";
  statusEl.textContent = "";

  try {
    const res = await fetch(getApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: getAuth() },
      body: JSON.stringify({ text, sourceLang: sourceLangVal, targetLang: targetLangVal, transliterate: translitToggle.checked }),
    });
    const data = await res.json();
    loadingSkeleton.style.display = "none";

    if (data.error) {
      output.textContent = data.error;
    } else {
      output.textContent = data.translation;
      showToast("Translated!", "green");

      if (data.transliteration) { translitOutput.textContent = data.transliteration; translitOutput.style.display = "block"; }
      else translitOutput.style.display = "none";

      if (data.detectedLang && sourceLangVal === "auto") {
        detectedLangText.textContent = "Detected: " + data.detectedLang;
        detectedLangEl.style.display = "inline-flex";
      } else detectedLangEl.style.display = "none";

      lastResult = { source: text, translation: data.translation, transliteration: data.transliteration || "",
        sourceLang: data.detectedLang || sourceLangVal, targetLang: targetLangVal };
      pushHistory({ ...lastResult, time: new Date().toLocaleString() });
    }
    resultArea.style.display = "block";
  } catch {
    loadingSkeleton.style.display = "none";
    output.textContent = "Connection error — is the server running?";
    resultArea.style.display = "block";
  } finally {
    translateBtn.disabled = false;
  }
}

// --- Swap languages ---
$("swapLangBtn").addEventListener("click", () => {
  if (sourceLangVal === "auto") return;
  const srcOpts = $("sourceLangMenu").querySelectorAll(".select-opt");
  const tgtOpts = $("targetLangMenu").querySelectorAll(".select-opt");
  const hasSrc = [...tgtOpts].find(o => o.dataset.value === sourceLangVal);
  const hasTgt = [...srcOpts].find(o => o.dataset.value === targetLangVal);
  if (!hasSrc || !hasTgt) return;

  const oldSrc = sourceLangVal, oldTgt = targetLangVal;
  sourceLangVal = oldTgt; targetLangVal = oldSrc;

  srcOpts.forEach(o => o.classList.toggle("active", o.dataset.value === sourceLangVal));
  tgtOpts.forEach(o => o.classList.toggle("active", o.dataset.value === targetLangVal));
  $("sourceLangBtn").textContent = hasTgt.textContent;
  $("targetLangBtn").textContent = hasSrc.textContent;

  if (output.textContent && lastResult) {
    inputEl.value = output.textContent; resultArea.style.display = "none";
    autoResize(); charCount.textContent = inputEl.value.length;
  }
});

// --- TTS ---
speakBtn.addEventListener("click", () => {
  const t = output.textContent; if (!t) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t);
  const langMap = { Darija: "ar", French: "fr", Spanish: "es", "Arabic (MSA)": "ar" };
  u.lang = langMap[targetLangVal] || "en"; u.rate = 0.9;
  speechSynthesis.speak(u);
});

// --- Copy ---
copyBtn.addEventListener("click", () => {
  let t = output.textContent;
  if (translitOutput.style.display !== "none") t += "\n(" + translitOutput.textContent + ")";
  if (!t) return;
  navigator.clipboard.writeText(t);
  showToast("Copied to clipboard", "green");
});

// --- Favorite ---
favBtn.addEventListener("click", () => {
  if (!lastResult) return;
  addFavorite(lastResult);
  showToast("Saved to favorites", "green");
});

// --- Keyboard shortcut ---
document.addEventListener("keydown", e => { if (e.ctrlKey && e.shiftKey && e.key === "D") { e.preventDefault(); doTranslate(); } });

// --- History (expandable items) ---
function renderHistory() {
  const h = loadHistory(), list = $("historyList");
  if (!h.length) { list.innerHTML = '<div class="empty">No translations yet</div>'; return; }
  list.innerHTML = h.map((e, i) => `
    <div class="list-item" data-idx="${i}">
      <div class="list-src">${esc(e.source)}</div>
      <div class="list-trl">${esc(e.translation)}</div>
      ${e.transliteration ? `<div class="list-translit">${esc(e.transliteration)}</div>` : ""}
      <div class="list-meta">
        <span>${esc(e.sourceLang || "?")} → ${esc(e.targetLang || "Darija")}</span>
        <span>${esc(e.time || "")}</span>
      </div>
      <div class="list-detail">
        <div class="detail-label">Original</div>
        <div class="detail-text ltr">${esc(e.source)}</div>
        <div class="detail-label">Translation</div>
        <div class="detail-text">${esc(e.translation)}</div>
        ${e.transliteration ? `<div class="detail-label">Transliteration</div><div class="detail-text ltr">${esc(e.transliteration)}</div>` : ""}
        <div class="detail-time">${esc(e.sourceLang || "?")} → ${esc(e.targetLang || "Darija")} · ${esc(e.time || "")}</div>
      </div>
    </div>`).join("");

  list.querySelectorAll(".list-item").forEach(el => {
    el.addEventListener("click", () => {
      const wasExpanded = el.classList.contains("expanded");
      list.querySelectorAll(".list-item.expanded").forEach(x => x.classList.remove("expanded"));
      if (!wasExpanded) el.classList.add("expanded");
    });
  });
}
$("clearHistoryBtn").addEventListener("click", () => { clearHistoryData(); renderHistory(); showToast("History cleared", ""); });
$("exportHistBtn").addEventListener("click", () => {
  const h = loadHistory(); if (!h.length) return;
  const blob = new Blob([JSON.stringify(h, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "darija_history.json"; a.click();
  showToast("History exported", "green");
});

// --- Favorites (expandable items) ---
function renderFavorites() {
  const f = loadFavorites(), list = $("favList");
  if (!f.length) { list.innerHTML = '<div class="empty">Save translations you want to keep</div>'; return; }
  list.innerHTML = f.map((e, i) => `
    <div class="list-item" data-fav="${i}">
      <div class="list-src">${esc(e.source)}</div>
      <div class="list-trl">${esc(e.translation)}</div>
      ${e.transliteration ? `<div class="list-translit">${esc(e.transliteration)}</div>` : ""}
      <div class="list-meta">
        <span>${esc(e.sourceLang || "?")} → ${esc(e.targetLang || "Darija")}</span>
        <span>${esc(e.savedAt || "")}</span>
      </div>
      <div class="list-detail">
        <div class="detail-label">Original</div>
        <div class="detail-text ltr">${esc(e.source)}</div>
        <div class="detail-label">Translation</div>
        <div class="detail-text">${esc(e.translation)}</div>
        ${e.transliteration ? `<div class="detail-label">Transliteration</div><div class="detail-text ltr">${esc(e.transliteration)}</div>` : ""}
        <div class="detail-time">Saved ${esc(e.savedAt || "")}</div>
        <button class="pill-btn danger" data-rm="${i}" style="margin-top:8px">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Remove
        </button>
      </div>
    </div>`).join("");

  list.querySelectorAll(".list-item").forEach(el => {
    el.addEventListener("click", e => {
      if (e.target.closest("[data-rm]")) return;
      const wasExpanded = el.classList.contains("expanded");
      list.querySelectorAll(".list-item.expanded").forEach(x => x.classList.remove("expanded"));
      if (!wasExpanded) el.classList.add("expanded");
    });
  });
  list.querySelectorAll("[data-rm]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      removeFavorite(+btn.dataset.rm);
      renderFavorites();
      showToast("Removed from saved", "");
    });
  });
}

function esc(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }
