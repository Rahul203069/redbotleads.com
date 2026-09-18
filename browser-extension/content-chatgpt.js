chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "GENERATE_OUTREACH") return;
  generate(message.prompt)
    .then((text) => sendResponse({ text }))
    .catch((error) => sendResponse({ error: error.message }));
  return true;
});

async function generate(prompt) {
  const composer = await waitFor(() => findComposer(), 45_000, "ChatGPT composer was not found. Sign in, then resume the run.");
  const previousResponses = document.querySelectorAll('[data-message-author-role="assistant"]').length;
  composer.focus();
  if (composer instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(composer, prompt);
    composer.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    document.execCommand("selectAll", false);
    document.execCommand("insertText", false, prompt);
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: prompt }));
  }

  const sendButton = await waitFor(() => findSendButton(), 15_000, "ChatGPT Send button was not available.");
  sendButton.click();
  const response = await waitForResponse(previousResponses);
  if (!response) throw new Error("ChatGPT response timed out.");
  return response.textContent?.trim() || "";
}

function findComposer() {
  return document.querySelector("#prompt-textarea")
    || document.querySelector('textarea[data-testid="prompt-textarea"]')
    || [...document.querySelectorAll('[contenteditable="true"]')].find((element) => element.getAttribute("data-virtualkeyboard") !== "true");
}

function findSendButton() {
  return document.querySelector('button[data-testid="send-button"]')
    || [...document.querySelectorAll("button")].find((button) => /send/i.test(button.getAttribute("aria-label") || ""));
}

async function waitForResponse(previousResponses) {
  const deadline = Date.now() + 180_000;
  let stableText = "";
  let stableTicks = 0;
  while (Date.now() < deadline) {
    const responses = [...document.querySelectorAll('[data-message-author-role="assistant"]')];
    const latest = responses.at(-1);
    const stopButton = document.querySelector('button[data-testid="stop-button"]')
      || [...document.querySelectorAll("button")].find((button) => /stop generating/i.test(button.getAttribute("aria-label") || ""));
    if (responses.length > previousResponses && latest?.textContent?.trim()) {
      const current = latest.textContent.trim();
      stableTicks = current === stableText ? stableTicks + 1 : 0;
      stableText = current;
      if (!stopButton && stableTicks >= 2) return latest;
    }
    await delay(1000);
  }
  return null;
}

async function waitFor(getter, timeout, errorMessage) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = getter();
    if (value) return value;
    await delay(500);
  }
  throw new Error(errorMessage);
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
