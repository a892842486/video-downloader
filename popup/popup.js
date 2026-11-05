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


const downloadButton = document.getElementById("download-button");

downloadButton.disabled = false;

downloadButton.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.url) {
    statusElement.textContent = "找不到目前分頁網址";
    return;
  }

  downloadButton.disabled = true;
  statusElement.textContent = "下載中...";

  try {
    const settings = await chrome.storage.local.get({
      downloadPath: "F:\\download",
    });

    const response = await chrome.runtime.sendMessage({
      action: "download",
      url: tab.url,
      downloadPath: settings.downloadPath,
    });

    if (response?.success) {
      statusElement.textContent = `下載完成：${response.title}`;
    } else {
      statusElement.textContent =
        `下載失敗：${response?.error || "未知錯誤"}`;
    }
  } catch (error) {
    statusElement.textContent = `通訊失敗：${error.message}`;
  } finally {
    downloadButton.disabled = false;
  }
});
