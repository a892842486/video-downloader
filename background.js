
console.log("[Video Downloader] background loaded");

const HOST_NAME = "com.video_downloader.host";

let nativePort = null;
let nextRequestId = 0;
const pendingRequests = new Map();

function connectHost() {
  if (nativePort) return nativePort;

  nativePort = chrome.runtime.connectNative(HOST_NAME);

  nativePort.onMessage.addListener((response) => {
    console.log("[Video Downloader] Python response:", response);

    const request = pendingRequests.get(response.requestId);
    if (!request) return;

    pendingRequests.delete(response.requestId);
    request.resolve(response);
  });

  nativePort.onDisconnect.addListener(() => {
    const error =
      chrome.runtime.lastError?.message || "Native Host disconnected";

    console.error("[Video Downloader]", error);

    nativePort = null;

    for (const request of pendingRequests.values()) {
      request.resolve({ success: false, error });
    }

    pendingRequests.clear();
  });

  return nativePort;
}

function sendToPython(message) {
  return new Promise((resolve) => {
    const requestId = ++nextRequestId;
    pendingRequests.set(requestId, { resolve });

    try {
      connectHost().postMessage({ ...message, requestId });
    } catch (error) {
      pendingRequests.delete(requestId);
      resolve({ success: false, error: error.message });
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "download") {
    sendToPython(message).then(sendResponse);
    return true;
  }
});
