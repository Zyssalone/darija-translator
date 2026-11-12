<?php
if ($_SERVER["REQUEST_METHOD"] === "POST" && isset($_SERVER["HTTP_X_REQUESTED_WITH"])) {
    header("Content-Type: application/json");
    $data = json_decode(file_get_contents("php://input"), true);
    $text = trim($data["text"] ?? "");
    if ($text === "") { echo json_encode(["error" => "Text is required"]); exit; }

    $payload = json_encode([
        "text" => $text,
        "sourceLang" => $data["sourceLang"] ?? "auto",
        "targetLang" => $data["targetLang"] ?? "Darija",
        "transliterate" => $data["transliterate"] ?? false
    ]);
    $ch = curl_init("http://localhost:8080/api/translate");
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ["Content-Type: application/json", "Authorization: Basic " . base64_encode("admin:password123")],
        CURLOPT_POSTFIELDS => $payload, CURLOPT_TIMEOUT => 60
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch); curl_close($ch);
    if ($err) { echo json_encode(["error" => "Connection error: $err"]); exit; }
    if ($httpCode !== 200) { echo json_encode(["error" => "Server error (HTTP $httpCode)"]); exit; }
    echo $response; exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Darija Translator</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --green: #16a34a; --green-dark: #15803d; --green-light: #dcfce7; --green-50: #f0fdf4;
  --white: #ffffff; --gray-50: #f9fafb; --gray-100: #f3f4f6; --gray-200: #e5e7eb;
  --gray-400: #9ca3af; --gray-500: #6b7280; --gray-700: #374151; --gray-900: #111827;
  --red: #ef4444; --radius: 12px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Inter', system-ui, sans-serif; background: var(--gray-50); color: var(--gray-900);
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 20px; -webkit-font-smoothing: antialiased;
}
.card {
  background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius);
  max-width: 520px; width: 100%; overflow: hidden;
}
.card-header {
  padding: 24px 28px 0; display: flex; align-items: center; gap: 12px;
}
.logo svg { display: block; }
.card-header h1 { font-size: 18px; font-weight: 700; }
.card-header p { font-size: 11px; color: var(--gray-400); margin-top: 1px; }
.badge {
  display: inline-block; background: var(--green-50); color: var(--green);
  padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 600;
  margin: 14px 28px 0; letter-spacing: .03em;
}
.card-body { padding: 20px 28px 28px; }

label { display: block; font-size: 10px; font-weight: 600; color: var(--gray-500); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
select, textarea {
  width: 100%; padding: 9px 12px; background: var(--white); color: var(--gray-900);
  border: 1px solid var(--gray-200); border-radius: 8px; font-size: 13px; font-family: inherit; transition: border-color .12s;
}
select:focus, textarea:focus { outline: none; border-color: var(--green); }
textarea { height: 100px; resize: vertical; line-height: 1.5; margin-bottom: 14px; }
.lang-row { display: flex; gap: 10px; margin-bottom: 14px; }
.lang-row > div { flex: 1; }
.toggle-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.toggle-row input { width: auto; margin: 0; accent-color: var(--green); }
.toggle-row label { margin: 0; text-transform: none; font-size: 12px; color: var(--gray-700); }

.btn {
  width: 100%; padding: 10px; border: none; border-radius: 8px;
  background: var(--green); color: #fff;
  font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; transition: background .12s;
}
.btn:hover { background: var(--green-dark); }
.btn:disabled { opacity: .45; cursor: not-allowed; }

.loading { display: none; text-align: center; padding: 20px; }
.spinner {
  display: inline-block; width: 20px; height: 20px;
  border: 2px solid var(--gray-200); border-top-color: var(--green);
  border-radius: 50%; animation: spin .6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading p { font-size: 11px; color: var(--gray-400); margin-top: 6px; }

.error { background: rgba(239,68,68,.06); border: 1px solid rgba(239,68,68,.15); color: var(--red); border-radius: 8px; padding: 10px; margin-top: 14px; font-size: 12px; }

.result-area { display: none; margin-top: 16px; }
.result-box {
  background: var(--green-50); border: 1px solid var(--green-light); border-radius: 8px;
  padding: 14px; direction: rtl; text-align: right;
  font-size: 16px; line-height: 1.7; font-weight: 500; min-height: 44px;
}
.translit-box {
  background: var(--gray-100); border-radius: 6px; padding: 8px 12px;
  font-size: 12px; color: var(--gray-500); font-style: italic; margin-top: 6px;
  direction: ltr; text-align: left;
}
.detected-box {
  display: inline-flex; align-items: center; gap: 4px;
  margin-top: 6px; padding: 2px 8px;
  background: var(--green-light); color: var(--green);
  border-radius: 12px; font-size: 10px; font-weight: 600;
}
.action-row { display: flex; gap: 6px; margin-top: 10px; }
.action-row button {
  flex: 1; padding: 8px; font-size: 12px; font-weight: 500; font-family: inherit;
  background: var(--white); color: var(--gray-700); border: 1px solid var(--gray-200);
  border-radius: 6px; cursor: pointer; transition: .12s;
}
.action-row button:hover { border-color: var(--green); color: var(--green); }
</style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <div class="logo">
      <svg width="36" height="36" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="#16a34a"/><path d="M8 11h7M11.5 11v10M8 14.5h7" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M18 21l2.5-7L23 21M18.8 19h4.4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 8l4 4-4 4" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/></svg>
    </div>
    <div>
      <h1>Darija Translator</h1>
      <p>Moroccan Arabic Dialect — PHP Client</p>
    </div>
  </div>
  <div class="badge">PHP + cURL + AJAX</div>
  <div class="card-body">
    <div class="lang-row">
      <div><label>From</label><select id="sourceLang">
        <option value="auto" selected>Auto-Detect</option>
        <option value="English">English</option><option value="French">French</option>
        <option value="Spanish">Spanish</option><option value="Arabic (MSA)">Arabic (MSA)</option>
      </select></div>
      <div><label>To</label><select id="targetLang">
        <option value="Darija" selected>Moroccan Darija</option>
        <option value="English">English</option><option value="French">French</option>
        <option value="Arabic (MSA)">Arabic (MSA)</option>
      </select></div>
    </div>
    <div class="toggle-row">
      <input type="checkbox" id="translitCheck">
      <label for="translitCheck">Show Latin transliteration</label>
    </div>
    <label>Text to translate</label>
    <textarea id="inputText" placeholder="Enter text to translate..."></textarea>
    <button class="btn" id="translateBtn">Translate</button>
    <div class="loading" id="loading"><div class="spinner"></div><p>Translating...</p></div>
    <div class="error" id="error" style="display:none"></div>
    <div class="result-area" id="resultArea">
      <label>Translation</label>
      <div class="result-box" id="result"></div>
      <div class="translit-box" id="translit" style="display:none"></div>
      <div class="detected-box" id="detected" style="display:none"></div>
      <div class="action-row">
        <button onclick="copyResult()">Copy</button>
        <button onclick="speakResult()">Read Aloud</button>
      </div>
    </div>
  </div>
</div>
<script>
const btn = document.getElementById("translateBtn");
btn.addEventListener("click", doTranslate);
document.getElementById("inputText").addEventListener("keydown", e => { if (e.key==="Enter" && e.ctrlKey) doTranslate(); });

async function doTranslate() {
  const text = document.getElementById("inputText").value.trim();
  if (!text) return;
  btn.disabled = true;
  document.getElementById("loading").style.display = "block";
  document.getElementById("resultArea").style.display = "none";
  document.getElementById("error").style.display = "none";
  try {
    const res = await fetch("", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: JSON.stringify({
        text, sourceLang: document.getElementById("sourceLang").value,
        targetLang: document.getElementById("targetLang").value,
        transliterate: document.getElementById("translitCheck").checked
      })
    });
    const data = await res.json();
    if (data.error) {
      document.getElementById("error").textContent = data.error;
      document.getElementById("error").style.display = "block";
    } else {
      document.getElementById("result").textContent = data.translation;
      const t = document.getElementById("translit");
      if (data.transliteration) { t.textContent = data.transliteration; t.style.display = "block"; } else t.style.display = "none";
      const d = document.getElementById("detected");
      if (data.detectedLang) { d.textContent = "Detected: " + data.detectedLang; d.style.display = "inline-flex"; } else d.style.display = "none";
      document.getElementById("resultArea").style.display = "block";
    }
  } catch (e) {
    document.getElementById("error").textContent = "Connection error: " + e.message;
    document.getElementById("error").style.display = "block";
  } finally { btn.disabled = false; document.getElementById("loading").style.display = "none"; }
}
function copyResult() {
  let t = document.getElementById("result").textContent;
  const tr = document.getElementById("translit");
  if (tr.style.display !== "none") t += "\n(" + tr.textContent + ")";
  navigator.clipboard.writeText(t);
}
function speakResult() {
  const t = document.getElementById("result").textContent; if (!t) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t); u.lang = "ar"; u.rate = 0.9; speechSynthesis.speak(u);
}
</script>
</body>
</html>
