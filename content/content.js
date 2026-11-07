
console.log("[Video Downloader] content.js loaded");

const detectedVideos = new WeakSet();
const videoButtons = new Map();

function updateButtonPosition(video, button) {
  const rect = video.getBoundingClientRect();

  const visible =
    video.isConnected &&
    rect.width >= 160 &&
    rect.height >= 90 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth;

  button.hidden = !visible;
  if (!visible) return;

  button.style.top = `${Math.max(8, rect.top + 12)}px`;
  button.style.left = `${Math.min(
    window.innerWidth - button.offsetWidth - 8,
    rect.right - button.offsetWidth - 12
  )}px`;
}

function addDownloadButton(video) {
  if (detectedVideos.has(video)) return;
  detectedVideos.add(video);

  console.log("[Video Downloader] 偵測到影片", video);

  const button = document.createElement("button");
  button.className = "video-downloader-button";
  button.textContent = "⬇ 下載";
  button.type = "button";
  button.hidden = true;


  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (button.disabled) return;

    button.disabled = true;
    button.textContent = "下載中...";

    try {
      // 讀取 Popup 儲存的下載路徑
      const settings = await chrome.storage.local.get({
        downloadPath: "F:\\download",
      });

      // 呼叫 background.js，使用共用下載流程
      const videoSource = video.currentSrc || video.src || null;

      console.log("[Video Downloader] Selected video:", {
        pageUrl: window.location.href,
        videoSource,
        title: document.title,
      });

      const response = await chrome.runtime.sendMessage({
        action: "download",
        url: window.location.href,
        referer: window.location.href,
        title: document.title,
        downloadPath: settings.downloadPath,
      });

      if (response?.success) {
        button.textContent = "✓ 已加入下載";
      } else {
        console.error("[Video Downloader]", response?.error);
        button.textContent = "✕ 下載失敗";
      }
    } catch (error) {
      console.error("[Video Downloader]", error);
      button.textContent = "✕ 下載失敗";
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.textContent = "⬇ 下載";
      }, 3000);
    }
  });


  document.documentElement.appendChild(button);
  videoButtons.set(video, button);

  updateButtonPosition(video, button);
}

function detectVideos() {
  document.querySelectorAll("video").forEach(addDownloadButton);
}

function updateAllButtons() {
  for (const [video, button] of videoButtons) {
    if (!video.isConnected) {
      button.remove();
      videoButtons.delete(video);
      continue;
    }

    updateButtonPosition(video, button);
  }
}

let scanScheduled = false;

const observer = new MutationObserver(() => {
  if (scanScheduled) return;

  scanScheduled = true;

  requestAnimationFrame(() => {
    scanScheduled = false;
    detectVideos();
    updateAllButtons();
  });
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

window.addEventListener("scroll", updateAllButtons, true);
window.addEventListener("resize", updateAllButtons);

detectVideos();
updateAllButtons();
