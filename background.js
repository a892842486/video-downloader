
console.log("[Video Downloader] background loaded");

const HOST_NAME = "com.video_downloader.host";
const STORAGE_KEY = "downloadTask";

let nativePort = null;
let nextRequestId = 0;
let activeTask = null;


let saveQueue = Promise.resolve();

function saveTask(task) {
  activeTask = task;

  saveQueue = saveQueue
    .catch((error) => {
      console.error("[Video Downloader] 儲存失敗:", error);
    })
    .then(() => {
      return chrome.storage.local.set({
        [STORAGE_KEY]: task,
      });
    });

  return saveQueue;
}


function connectHost() {
  if (nativePort) return nativePort;

  const port = chrome.runtime.connectNative(HOST_NAME);
  nativePort = port;

  port.onMessage.addListener((response) => {
    console.log("[Video Downloader] Python response:", response);

    if (!activeTask) return;
    if (response.requestId !== activeTask.requestId) return;

    if (response.event === "progress") {
      void saveTask({
        ...activeTask,
        status: response.status === "finished"
          ? "processing"
          : "downloading",
        downloadedBytes: response.downloadedBytes ?? 0,
        totalBytes: response.totalBytes ?? null,
        percent: response.percent ?? null,
        speed: response.speed ?? null,
        eta: response.eta ?? null,
      });

      return;
    }


if (response.event === "completed") {
  void saveTask({
    ...activeTask,
    status: "completed",
    percent: 100,
    downloadedBytes: activeTask.downloadedBytes,
    totalBytes: activeTask.totalBytes,
    speed: null,
    eta: 0,
    title: response.title || activeTask.title,
  });

  return;
}


    if (response.event === "error") {
      void saveTask({
        ...activeTask,
        status: "error",
        error: response.error || "下載失敗",
        speed: null,
        eta: null,
      });
    }
  });

  port.onDisconnect.addListener(() => {
    const error =
      chrome.runtime.lastError?.message ||
      "Native Host disconnected";

    console.log("[Video Downloader] Native Host disconnected:", error);

    if (nativePort === port) {
      nativePort = null;
    }

    if (
      activeTask &&
      ["downloading", "processing"].includes(activeTask.status)
    ) {
      void saveTask({
        ...activeTask,
        status: "error",
        error,
        speed: null,
        eta: null,
      });
    }
  });

  return port;
}

async function startDownload(message) {
  if (
    activeTask &&
    ["downloading", "processing"].includes(activeTask.status)
  ) {
    return {
      success: false,
      error: "目前已有下載任務進行中",
    };
  }

  const task = {
    requestId: Date.now(),
    title: message.title || "下載中的影片",
    url: message.url,
    downloadPath: message.downloadPath,
    status: "downloading",
    downloadedBytes: 0,
    totalBytes: null,
    percent: null,
    speed: null,
    eta: null,
    error: null,
  };

  await saveTask(task);

  try {
    connectHost().postMessage({
      action: "download",
      requestId: task.requestId,
      url: task.url,
      downloadPath: task.downloadPath,
    });

    return {
      success: true,
      requestId: task.requestId,
    };
  } catch (error) {
    await saveTask({
      ...task,
      status: "error",
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "download") {
    startDownload(message).then(sendResponse).catch((error) => {
      sendResponse({
        success: false,
        error: error.message,
      });
    });

    return true;
  }

  if (message.action === "getDownloadTask") {
    chrome.storage.local.get(STORAGE_KEY).then((result) => {
      sendResponse(result[STORAGE_KEY] || null);
    });

    return true;
  }
});
