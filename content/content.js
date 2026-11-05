
console.log("[Video Downloader] content.js loaded");
const detectedVideos = new WeakSet();

function detectVideos() {
  const videos = document.querySelectorAll("video");

  videos.forEach((video) => {
    // 避免同一個影片重複偵測
    if (detectedVideos.has(video)) return;

    detectedVideos.add(video);

    console.log("[Video Downloader] 偵測到影片", {
      src: video.currentSrc || video.src || "尚無來源",
      width: video.videoWidth,
      height: video.videoHeight,
    });
  });
}

// 初次掃描
detectVideos();

// 監聽動態新增的影片
const observer = new MutationObserver(() => {
  detectVideos();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});
