
console.log("[Video Downloader] popup.js loaded");

const titleElement = document.getElementById("video-title");
const urlElement = document.getElementById("video-url");
const pathInput = document.getElementById("download-path");
const saveButton = document.getElementById("save-button");
const downloadButton = document.getElementById("download-button");
const statusElement = document.getElementById("status");

const progressSection = document.getElementById("download-progress");
const taskTitle = document.getElementById("task-title");
const progressStatus = document.getElementById("progress-status");
const progressPercent = document.getElementById("progress-percent");
const progressBar = document.getElementById("progress-bar");
const progressSize = document.getElementById("progress-size");
const progressSpeed = document.getElementById("progress-speed");
const progressEta = document.getElementById("progress-eta");

const ACTIVE_STATUSES = ["downloading", "processing"];

// Bytes 轉換成 MB
function formatMB(bytes) {
  if (bytes == null) return "--";
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Bytes/s 轉換成 MB/s
function formatSpeed(speed) {
  if (speed == null) return "-- MB/s";
  return `${(speed / (1024 * 1024)).toFixed(2)} MB/s`;
}

// 秒數格式化
function formatETA(seconds) {
  if (seconds == null) return "--";

  const value = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(value / 60);
  const remainingSeconds = value % 60;

  if (minutes === 0) return `${remainingSeconds} 秒`;
  return `${minutes} 分 ${remainingSeconds} 秒`;
}

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

// 更新下載進度介面
function renderDownloadTask(task) {
  if (!task) {
    progressSection.hidden = true;
    downloadButton.disabled = false;
    return;
  }

  progressSection.hidden = false;
  taskTitle.textContent = task.title || "未知影片";

  const isActive = ACTIVE_STATUSES.includes(task.status);
  downloadButton.disabled = isActive;

  const statusLabels = {
    downloading: "下載中...",
    processing: "處理影片中...",
    completed: "下載完成",
    error: "下載失敗",
  };

  progressStatus.textContent =
    statusLabels[task.status] || "準備中...";

  const percent = task.percent;
  progressPercent.textContent =
    percent == null ? "--" : `${percent.toFixed(1)}%`;

  progressBar.style.width =
    percent == null
      ? "0%"
      : `${Math.min(100, Math.max(0, percent))}%`;

  progressSize.textContent =
    `${formatMB(task.downloadedBytes)} / ${formatMB(task.totalBytes)}`;

  progressSpeed.textContent =
    isActive ? formatSpeed(task.speed) : "-- MB/s";

  progressEta.textContent =
    task.status === "downloading"
      ? `剩餘時間：${formatETA(task.eta)}`
      : task.status === "processing"
        ? "正在合併或處理影片..."
        : task.status === "completed"
          ? "影片已儲存完成"
          : task.error || "下載失敗";

  if (task.status === "error") {
    statusElement.textContent = `下載失敗：${task.error || "未知錯誤"}`;
  } else if (task.status === "completed") {
    statusElement.textContent = "下載完成！";
  } else if (isActive) {
    statusElement.textContent = "";
  }
}

// 初始化時取得現有下載任務
async function loadDownloadTask() {
  const response = await chrome.runtime.sendMessage({
    action: "getDownloadTask",
  });

  renderDownloadTask(response);
}

// 監聽背景任務狀態變更
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes.downloadTask) {
    renderDownloadTask(changes.downloadTask.newValue);
  }
});

// 儲存下載任務
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
  statusElement.textContent = "正在建立下載任務...";

  try {
    const settings = await chrome.storage.local.get({
      downloadPath: "F:\\download",
    });

    const response = await chrome.runtime.sendMessage({
      action: "download",
      url: tab.url,
      title: tab.title || "未知影片",
      downloadPath: settings.downloadPath,
    });

    if (response?.success) {
      statusElement.textContent = "下載任務已建立";
      await loadDownloadTask();
    } else {
      statusElement.textContent =
        `無法建立下載任務：${response?.error || "未知錯誤"}`;
    }
  } catch (error) {
    statusElement.textContent = `通訊失敗：${error.message}`;
  } finally {
    await loadDownloadTask().catch(console.error);
  }
});

// 初始化
loadCurrentTab();
loadSettings();
loadDownloadTask().catch(console.error);
