
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

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const title = document.title;
    const src = video.currentSrc || video.src || "尚無來源";

    alert(
      `影片標題：${title}\n` +
      `影片來源：${src}\n\n` +
      "下一階段將加入下載設定視窗。"
    );
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
