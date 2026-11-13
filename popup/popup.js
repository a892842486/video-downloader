
console.log("[Video Downloader] popup.js loaded");

const pathInput = document.getElementById("download-path");
const statusElement = document.getElementById("status");

const downloadButtonsToggle = document.getElementById(
  "download-buttons-toggle"
);

const tasksSection = document.getElementById("download-tasks");
const tasksList = document.getElementById("tasks-list");
const tasksCount = document.getElementById("tasks-count");
const clearHistoryButton = document.getElementById("clear-history-button");

const STATUS_LABELS = {
  downloading: "下載中",
  processing: "處理中",
  completed: "已完成",
  error: "下載失敗",
  skipped: "已跳過",
  interrupted: "已中斷",
  cancelled: "已取消",
};

// Bytes 轉換成 MB
function formatMB(bytes) {
  if (!Number.isFinite(bytes)) return "--";
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Bytes/s 轉換成 MB/s
function formatSpeed(speed) {
  if (!Number.isFinite(speed)) return "-- MB/s";
  return `${(speed / (1024 * 1024)).toFixed(2)} MB/s`;
}

// 秒數格式化
function formatETA(seconds) {
  if (!Number.isFinite(seconds)) return "--";

  const value = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(value / 60);
  const remainingSeconds = value % 60;

  if (minutes === 0) return `${remainingSeconds} 秒`;
  return `${minutes} 分 ${remainingSeconds} 秒`;
}

// 安全建立 HTML 元素
function createElement(tag, className = "", text = null) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== null) element.textContent = text;

  return element;
}

// 讀取已儲存設定
async function loadSettings() {
  const settings = await chrome.storage.local.get({
    downloadPath: "F:\\download",
    downloadButtonsEnabled: false,
  });

  pathInput.value = settings.downloadPath;
  downloadButtonsToggle.checked = settings.downloadButtonsEnabled;
}

// 下載按鈕顯示開關
downloadButtonsToggle.addEventListener("change", async () => {
  const enabled = downloadButtonsToggle.checked;

  try {
    await chrome.storage.local.set({
      downloadButtonsEnabled: enabled,
    });
  } catch (error) {
    downloadButtonsToggle.checked = !enabled;
    statusElement.textContent = `設定儲存失敗：${error.message}`;
  }
});

// 下載位置修改完成後自動儲存
pathInput.addEventListener("change", async () => {
  const downloadPath = pathInput.value.trim();

  if (!downloadPath) {
    statusElement.textContent = "請輸入下載位置";
    return;
  }

  try {
    await chrome.storage.local.set({ downloadPath });
    statusElement.textContent = "下載位置已儲存";
  } catch (error) {
    statusElement.textContent = `儲存失敗：${error.message}`;
  }
});

// 建立單一下載任務卡片
function renderTask(task) {
  const card = createElement("div", "download-task");

  const header = createElement("div", "task-header");

  const title = createElement(
    "span",
    "task-title",
    task.title || "未知影片"
  );

  title.title = task.title || "未知影片";

  const status = createElement(
    "span",
    `task-status ${task.status}`,
    STATUS_LABELS[task.status] || "未知狀態"
  );

  header.append(title, status);

  if (["downloading", "processing"].includes(task.status)) {
    const cancelButton = createElement(
      "button",
      "task-cancel-button",
      "取消"
    );

    cancelButton.type = "button";
    cancelButton.title = "取消這部影片的下載";

    cancelButton.addEventListener("click", async () => {
      cancelButton.disabled = true;
      cancelButton.textContent = "取消中...";

      try {
        const response = await chrome.runtime.sendMessage({
          action: "cancelDownload",
          taskId: task.id,
        });

        console.log("[Video Downloader] Cancel response:", response);

        if (!response?.success) {
          statusElement.textContent =
            `取消失敗：${response?.error || "未知錯誤"}`;
          cancelButton.disabled = false;
          cancelButton.textContent = "取消";
        }
      } catch (error) {
        statusElement.textContent = `取消失敗：${error.message}`;
        cancelButton.disabled = false;
        cancelButton.textContent = "取消";
      }
    });

    header.appendChild(cancelButton);
  } else {
    const removeButton = createElement(
      "button",
      "task-remove-button",
      "×"
    );

    removeButton.type = "button";
    removeButton.title = "移除這筆下載紀錄";

    removeButton.addEventListener("click", async () => {
      removeButton.disabled = true;

      try {
        const response = await chrome.runtime.sendMessage({
          action: "removeDownloadTask",
          taskId: task.id,
        });

        if (!response?.success) {
          statusElement.textContent =
            `移除失敗：${response?.error || "未知錯誤"}`;
          removeButton.disabled = false;
        }
      } catch (error) {
        statusElement.textContent = `移除失敗：${error.message}`;
        removeButton.disabled = false;
      }
    });

    header.appendChild(removeButton);
  }

  card.appendChild(header);

  if (task.folderCreated) {
    card.appendChild(
      createElement(
        "div",
        "task-message",
        `📁 已建立新資料夾：${task.folderCreated}`
      )
    );
  }

  const showProgress = [
    "downloading",
    "processing",
    "completed",
  ].includes(task.status);

  if (showProgress) {
    const progress = createElement("div", "task-progress");

    const fill = createElement(
      "div",
      `task-progress-fill ${task.status}`
    );

    const percent = Number.isFinite(task.percent)
      ? Math.min(100, Math.max(0, task.percent))
      : 0;

    fill.style.width = `${percent}%`;

    progress.appendChild(fill);
    card.appendChild(progress);

    const details = createElement("div", "task-details");

    const size = createElement(
      "span",
      "",
      `${formatMB(task.downloadedBytes)} / ${formatMB(task.totalBytes)}`
    );

    const percentage = createElement(
      "span",
      "",
      Number.isFinite(task.percent)
        ? `${task.percent.toFixed(1)}%`
        : "--%"
    );

    details.append(size, percentage);
    card.appendChild(details);

    if (task.status === "downloading") {
      card.appendChild(
        createElement(
          "div",
          "task-message",
          `${formatSpeed(task.speed)} · 剩餘時間：${formatETA(task.eta)}`
        )
      );
    }

    if (task.status === "processing") {
      card.appendChild(
        createElement(
          "div",
          "task-message",
          "正在合併或處理影片..."
        )
      );
    }

    if (task.status === "completed") {
      card.appendChild(
        createElement(
          "div",
          "task-message",
          "影片已儲存完成"
        )
      );
    }
  }

  if (task.status === "cancelled") {
    card.appendChild(
      createElement("div", "task-message", "使用者已取消下載")
    );
  }

  if (task.status === "skipped") {
    card.appendChild(
      createElement(
        "div",
        "task-message",
        task.error || "檔案已存在，已跳過下載"
      )
    );
  }

  if (["error", "interrupted"].includes(task.status)) {
    card.appendChild(
      createElement(
        "div",
        "task-message",
        task.error || "下載中斷"
      )
    );
  }

  return card;
}

// 清空所有非進行中的下載紀錄
clearHistoryButton.addEventListener("click", async () => {
  if (!confirm("確定清空所有下載紀錄？正在下載的任務會保留。")) {
    return;
  }

  clearHistoryButton.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      action: "clearDownloadHistory",
    });

    if (!response?.success) {
      statusElement.textContent =
        `清空失敗：${response?.error || "未知錯誤"}`;
    }
  } catch (error) {
    statusElement.textContent = `清空失敗：${error.message}`;
  } finally {
    clearHistoryButton.disabled = false;
  }
});

// 更新整份下載清單
function renderTasks(tasks) {
  tasksList.replaceChildren();

  clearHistoryButton.disabled =
    !Array.isArray(tasks) ||
    !tasks.some((task) =>
      !["downloading", "processing"].includes(task.status)
    );

  if (!Array.isArray(tasks) || tasks.length === 0) {
    tasksSection.hidden = true;
    tasksCount.textContent = "0 個任務";
    return;
  }

  tasksSection.hidden = false;
  tasksCount.textContent = `${tasks.length} 個任務`;

  const sortedTasks = [...tasks].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );

  for (const task of sortedTasks) {
    tasksList.appendChild(renderTask(task));
  }
}

// 讀取現有下載任務
async function loadDownloadTasks() {
  const tasks = await chrome.runtime.sendMessage({
    action: "getDownloadTasks",
  });

  renderTasks(tasks);
}

// 監聽背景任務狀態變更
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes.downloadTasks) {
    renderTasks(changes.downloadTasks.newValue || []);
  }
});

// 初始化
loadSettings().catch(console.error);
loadDownloadTasks().catch(console.error);
