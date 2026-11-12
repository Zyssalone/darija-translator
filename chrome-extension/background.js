chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translate-darija",
    title: "Translate to Darija",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translate-darija" && info.selectionText) {
    chrome.sidePanel.open({ tabId: tab.id });
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: "translate", text: info.selectionText });
    }, 500);
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});
