
console.log("[Video Downloader] background loaded");

const HOST_NAME = "com.video_downloader.host";
const STORAGE_KEY = "downloadTasks";

const tasks = new Map();
const ports = new Map();

// 記錄每個分頁偵測到的 HLS 來源
const hlsSources = new Map();

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;

    let url;

    try {
      url = new URL(details.url);
    } catch {
      return;
    }

    if (!/\.m3u8$/i.test(url.pathname)) return;

    if (!hlsSources.has(details.tabId)) {
      hlsSources.set(details.tabId, new Set());
    }

    hlsSources.get(details.tabId).add(details.url);

    console.log("[Video Downloader] HLS detected:", {
      tabId: details.tabId,
      url: details.url,
    });
  },
  {
    urls: ["http://*/*", "https://*/*"],
  }
);

// 一般網頁導航時，清除舊的 HLS 來源
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;

  hlsSources.delete(details.tabId);
});

// 分頁關閉時，清除 HLS 來源
chrome.tabs.onRemoved.addListener((tabId) => {
  hlsSources.delete(tabId);
});

const ACTIVE_STATUSES = ["downloading", "processing"];

let saveQueue = Promise.resolve();
let initialized = false;
let initPromise = null;

// 依序儲存任務，避免非同步寫入順序錯亂
function saveTasks() {
  const snapshot = Array.from(tasks.values()).map((task) => ({
    ...task,
  }));

  saveQueue = saveQueue
    .catch((error) => {
      console.error("[Video Downloader] 儲存失敗:", error);
    })
    .then(() => chrome.storage.local.set({
      [STORAGE_KEY]: snapshot,
    }));

  return saveQueue;
}

// 初始化：讀取上次保存的任務
async function initializeTasks() {
  if (initialized) return;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const savedTasks = result[STORAGE_KEY] || [];

    for (const task of savedTasks) {
      if (ACTIVE_STATUSES.includes(task.status)) {
        // Service Worker 重啟後，舊連線可能已中斷
        task.status = "interrupted";
        task.speed = null;
        task.eta = null;
      }

      tasks.set(task.id, task);
    }

    initialized = true;
    await saveTasks();
  })();

  return initPromise;
}

function updateTask(taskId, changes) {
  const task = tasks.get(taskId);
  if (!task) return;

  tasks.set(taskId, {
    ...task,
    ...changes,
  });

  void saveTasks();
}

// 每個下載任務建立獨立 Native Messaging 連線
function connectDownload(task) {
  const port = chrome.runtime.connectNative(HOST_NAME);

  ports.set(task.id, port);

  port.onMessage.addListener((response) => {

    const current = tasks.get(task.id);

    if (!current) return;
    if (response.requestId !== task.id) return;

    if (response.event === "folder_created") {
      updateTask(task.id, {
        folderCreated: response.path,
      });

      return;
    }

    if (response.event === "progress") {
      updateTask(task.id, {
        status: response.status === "finished"
          ? "processing"
          : "downloading",
        downloadedBytes: response.downloadedBytes ?? current.downloadedBytes,
        totalBytes: response.totalBytes ?? current.totalBytes,
        percent: response.percent ?? current.percent,
        speed: response.speed ?? null,
        eta: response.eta ?? null,
      });

      return;
    }

    if (response.event === "skipped") {
      updateTask(task.id, {
        status: "skipped",
        title: response.title || current.title,
        error: `檔案已存在：${response.filename || "未知檔案"}`,
        speed: null,
        eta: null,
      });

      port.disconnect();
      return;
    }

    if (response.event === "completed") {
      updateTask(task.id, {
        status: "completed",
        percent: 100,
        speed: null,
        eta: 0,
        title: response.title || current.title,
      });

      port.disconnect();
      return;
    }

    if (response.event === "error") {
      updateTask(task.id, {
        status: "error",
        error: response.error || "下載失敗",
        speed: null,
        eta: null,
      });

      port.disconnect();
    }
  });

  port.onDisconnect.addListener(() => {
    ports.delete(task.id);

    const current = tasks.get(task.id);

    if (
      current &&
      ACTIVE_STATUSES.includes(current.status)
    ) {
      updateTask(task.id, {
        status: "interrupted",
        error: chrome.runtime.lastError?.message ||
          "Native Host disconnected",
        speed: null,
        eta: null,
      });
    }
  });

  port.postMessage({
    action: "download",
    requestId: task.id,
    url: task.url,
    fallbackUrl: task.fallbackUrl,
    referer: task.referer,
    title: task.title,
    downloadPath: task.downloadPath,
  });
}

async function cancelDownload(taskId) {
  await initializeTasks();

  console.log("[Video Downloader] Cancel requested:", taskId);

  const task = tasks.get(taskId);

  if (!task) {
    return { success: false, error: "找不到下載任務" };
  }

  if (!ACTIVE_STATUSES.includes(task.status)) {
    return { success: false, error: "此任務目前無法取消" };
  }

  const port = ports.get(taskId);

  if (!port) {
    return { success: false, error: "下載連線已不存在" };
  }

  // 先更新記憶體狀態，避免 onDisconnect 誤判
  tasks.set(taskId, {
    ...task,
    status: "cancelled",
    speed: null,
    eta: null,
    error: null,
  });

  console.log("[Video Downloader] Disconnecting port:", taskId);

  // 中斷指定任務的 Native Host
  port.disconnect();
  ports.delete(taskId);

  // 最後儲存取消狀態
  await saveTasks();

  return { success: true };
}

// 移除單筆下載紀錄
async function removeDownloadTask(taskId) {
  await initializeTasks();

  const task = tasks.get(taskId);

  if (!task) {
    return { success: false, error: "找不到下載任務" };
  }

  if (ACTIVE_STATUSES.includes(task.status)) {
    return { success: false, error: "無法移除正在下載的任務" };
  }

  tasks.delete(taskId);
  await saveTasks();

  return { success: true };
}

// 清空所有非進行中的下載紀錄
async function clearDownloadHistory() {
  await initializeTasks();

  let removedCount = 0;

  for (const [taskId, task] of tasks) {
    if (ACTIVE_STATUSES.includes(task.status)) continue;

    tasks.delete(taskId);
    removedCount++;
  }

  await saveTasks();

  return { success: true, removedCount };
}

// 新增下載任務
async function startDownload(message, sender) {
  await initializeTasks();

  const tabId = sender.tab?.id;
  const sources = tabId != null
    ? [...(hlsSources.get(tabId) || [])]
    : [];

  // 優先使用主播放清單，讓 yt-dlp 自行選擇畫質
  const masterPlaylist = sources.find((url) =>
    /\/playlist\.m3u8(?:\?|$)/i.test(url)
  );

  const hlsUrl = masterPlaylist || sources.find((url) => {
    try {
      return new URL(url).pathname.toLowerCase().endsWith(".m3u8");
    } catch {
      return false;
    }
  });

  const normalizedUrl = message.url?.trim();
  const fallbackUrl = hlsUrl || null;

  const duplicateTask = Array.from(tasks.values()).find(
    (task) =>
      task.url === normalizedUrl &&
      ACTIVE_STATUSES.includes(task.status)
  );

  if (duplicateTask) {
    return {
      success: false,
      error: "這部影片已經在下載中，請勿重複下載",
    };
  }


  if (!normalizedUrl?.startsWith("http")) {
    return {
      success: false,
      error: "無效的影片網址",
    };
  }

  const task = {
    id: crypto.randomUUID(),
    title: message.title || "未知影片",
    url: normalizedUrl,
    fallbackUrl,
    referer: message.referer || null,
    downloadPath: message.downloadPath,
    status: "downloading",
    downloadedBytes: 0,
    totalBytes: null,
    percent: null,
    speed: null,
    eta: null,
    error: null,
    createdAt: Date.now(),
  };

  tasks.set(task.id, task);
  await saveTasks();

  try {
    connectDownload(task);

    return {
      success: true,
      taskId: task.id,
    };
  } catch (error) {
    updateTask(task.id, {
      status: "error",
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

// Chrome 訊息入口
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "download") {
    startDownload(message, sender)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message,
        });
      });

    return true;
  }

  if (message.action === "getDownloadTasks") {
    initializeTasks()
      .then(() => sendResponse(Array.from(tasks.values())))
      .catch((error) => {
        console.error("[Video Downloader]", error);
        sendResponse([]);
      });

    return true;
  }

  if (message.action === "cancelDownload") {
    cancelDownload(message.taskId)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message,
        });
      });

    return true;
  }

  if (message.action === "removeDownloadTask") {
    removeDownloadTask(message.taskId)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message,
        });
      });

    return true;
  }

  if (message.action === "clearDownloadHistory") {
    clearDownloadHistory()
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message,
        });
      });

    return true;
  }

});
