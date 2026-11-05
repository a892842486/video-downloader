
console.log("[Video Downloader] background loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== "testNative") {
    return;
  }

  chrome.runtime.sendNativeMessage(
    "com.video_downloader.host",
    {
      action: "ping",
      message: "Hello from Chrome!",
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Video Downloader] Native Messaging error:",
          chrome.runtime.lastError.message
        );

        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message,
        });

        return;
      }

      console.log("[Video Downloader] Python response:", response);
      sendResponse(response);
    }
  );

  return true;
});
