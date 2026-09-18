const extensionVersion = chrome.runtime.getManifest().version;

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin || event.data?.source !== "redbot-web") return;
  if (event.data.type === "OUTREACH_PING") {
    window.postMessage({ source: "redbot-extension", type: "OUTREACH_PONG", version: extensionVersion }, window.location.origin);
    return;
  }
  if (["OUTREACH_START", "OUTREACH_PAUSE", "OUTREACH_RESUME", "OUTREACH_STOP"].includes(event.data.type)) {
    chrome.runtime.sendMessage({
      type: event.data.type,
      runId: event.data.runId,
      appOrigin: window.location.origin,
      extensionVersion,
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "APP_API_FETCH") {
    fetch(message.path, {
      method: message.method || "GET",
      headers: message.body ? { "content-type": "application/json" } : undefined,
      body: message.body ? JSON.stringify(message.body) : undefined,
      cache: "no-store",
      credentials: "same-origin",
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      sendResponse({ ok: response.ok, status: response.status, data });
    }).catch((error) => sendResponse({ ok: false, status: 0, data: { error: error.message } }));
    return true;
  }
  if (message.type === "OUTREACH_NOTIFY") {
    window.postMessage({ source: "redbot-extension", type: "OUTREACH_RUN_UPDATE", runId: message.runId }, window.location.origin);
  }
});

window.postMessage({ source: "redbot-extension", type: "OUTREACH_PONG", version: extensionVersion }, window.location.origin);
chrome.runtime.sendMessage({ type: "OUTREACH_APP_READY", appOrigin: window.location.origin }).catch(() => null);
