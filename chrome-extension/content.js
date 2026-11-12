// --- Auto-translate on text selection ---
let debounce = null;
document.addEventListener("mouseup", () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    const text = window.getSelection().toString().trim();
    if (text && text.length > 1 && text.length < 5000) {
      chrome.runtime.sendMessage({ action: "selection", text });
    }
  }, 300);
});

// --- Translate entire page ---
let originalTexts = new Map();
let pageTranslated = false;

function getTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tag = node.parentElement?.tagName;
      if (!tag || ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "CODE", "PRE"].includes(tag)) return NodeFilter.FILTER_REJECT;
      if (node.textContent.trim().length < 2) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "ping") { sendResponse({ ok: true }); return; }
  if (msg.action === "translatePage") {
    if (pageTranslated) {
      originalTexts.forEach((orig, node) => { node.textContent = orig; });
      originalTexts.clear();
      pageTranslated = false;
      sendResponse({ status: "restored" });
      return;
    }

    const nodes = getTextNodes(document.body);
    const texts = nodes.map(n => n.textContent.trim()).filter(t => t.length > 0);
    if (!texts.length) { sendResponse({ status: "empty" }); return; }

    originalTexts.clear();
    nodes.forEach(n => originalTexts.set(n, n.textContent));

    sendResponse({ status: "collecting", count: texts.length });

    // batch in chunks of 20
    const chunks = [];
    for (let i = 0; i < texts.length; i += 20) chunks.push(texts.slice(i, i + 20));

    (async () => {
      let allTranslations = [];
      for (const chunk of chunks) {
        try {
          const res = await chrome.runtime.sendMessage({ action: "batchTranslate", texts: chunk });
          if (res && res.translations) allTranslations.push(...res.translations);
          else allTranslations.push(...chunk);
        } catch {
          allTranslations.push(...chunk);
        }
      }

      let ti = 0;
      nodes.forEach(node => {
        const orig = node.textContent.trim();
        if (orig.length > 0 && ti < allTranslations.length) {
          node.textContent = allTranslations[ti] || node.textContent;
          ti++;
        }
      });
      pageTranslated = true;
      chrome.runtime.sendMessage({ action: "pageTranslateDone" });
    })();

    return true;
  }
});
