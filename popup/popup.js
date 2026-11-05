console.log("[Video Downloader] popup.js loaded");
const titleElement = document.getElementById("video-title");
const urlElement = document.getElementById("video-url");
const pathInput = document.getElementById("download-path");
const saveButton = document.getElementById("save-button");
const statusElement = document.getElementById("status");

// 取得目前分頁資訊
async function loadCurrentTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab) {
    titleElement.textContent = "找不到目前分頁";
    urlElement.textContent = "-";
    return;
  }

  titleElement.textContent = tab.title || "未知標題";
  urlElement.textContent = tab.url || "未知網址";
}

// 讀取已儲存設定
async function loadSettings() {
  const settings = await chrome.storage.local.get({
    downloadPath: "F:\\download",
  });

  pathInput.value = settings.downloadPath;
}

// 儲存設定
saveButton.addEventListener("click", async () => {
  const downloadPath = pathInput.value.trim();

  if (!downloadPath) {
    statusElement.textContent = "請輸入下載位置";
    return;
  }

  await chrome.storage.local.set({ downloadPath });

  statusElement.textContent = "設定已儲存！";
});

// 初始化
loadCurrentTab();
loadSettings();
