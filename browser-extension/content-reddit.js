let activeAttempt = null;
let sendListenerInstalled = false;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SCAN_REDDIT_POST") {
    scanPost(message.limit || 100)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
  if (message.type === "PREPARE_REDDIT_CHAT") {
    activeAttempt = message.attempt;
    prepareChat(message.attempt)
      .then(sendResponse)
      .catch((error) => sendResponse({ prepared: false, error: error.message }));
    return true;
  }
});

chrome.runtime.sendMessage({ type: "REDDIT_TAB_READY" }).catch(() => null);

async function scanPost(limit) {
  await delay(1200);
  for (let pass = 0; pass < 30; pass += 1) {
    const current = extractComments(limit);
    if (current.length >= limit) break;
    const expanders = deepQueryAll("button").filter((button) => /more replies|continue this thread|load more comments|view more comments/i.test(button.textContent || ""));
    const button = expanders.find((item) => !item.disabled);
    if (!button) break;
    button.click();
    await delay(900);
  }

  const postElement = deepQuery("shreddit-post") || document.querySelector(".thing.link") || document.querySelector("main article");
  const title = postElement?.getAttribute?.("post-title") || deepQuery("h1")?.textContent?.trim() || document.title;
  const author = postElement?.getAttribute?.("author") || readUsername(postElement) || "";
  const bodyElement = postElement?.querySelector?.('[slot="text-body"], [slot="post-text"], .usertext-body, [data-post-click-location="text-body"]');
  return {
    post: {
      title: String(title || "").slice(0, 500),
      author,
      body: String(bodyElement?.textContent || "").trim().slice(0, 8000),
      url: location.href,
    },
    comments: extractComments(limit),
  };
}

function extractComments(limit) {
  const elements = [
    ...deepQueryAll("shreddit-comment"),
    ...deepQueryAll(".comment[data-author]"),
  ];
  const seen = new Set();
  const comments = [];
  for (const element of elements) {
    const username = element.getAttribute?.("author") || element.getAttribute?.("data-author") || readUsername(element);
    if (!username || /^(\[deleted\]|deleted)$/i.test(username)) continue;
    const id = element.getAttribute?.("thingid") || element.getAttribute?.("data-fullname") || element.id || `comment-${comments.length + 1}`;
    if (seen.has(id)) continue;
    const body = element.querySelector?.('[slot="comment"], [slot="comment-body"], .md, [data-testid="comment"]')?.textContent?.trim()
      || element.textContent?.trim();
    if (!body) continue;
    const permalink = element.getAttribute?.("permalink") || element.querySelector?.('a[href*="/comments/"]')?.href || location.href;
    seen.add(id);
    comments.push({ id, username, body: body.slice(0, 3000), permalink });
    if (comments.length >= limit) break;
  }
  return comments;
}

async function prepareChat(attempt) {
  renderOverlay(attempt);
  installSendListener();
  const chatButton = await waitFor(() => deepQueryAll("button, a").find((element) => /^chat$/i.test((element.textContent || "").trim())), 12_000).catch(() => null);
  if (chatButton) chatButton.click();
  const composer = await waitFor(findChatComposer, 30_000).catch(() => null);
  if (!composer) return { prepared: false };
  fillComposer(composer, attempt.message);
  return { prepared: true };
}

function findChatComposer() {
  const candidates = deepQueryAll('textarea, [contenteditable="true"]');
  return candidates.find((element) => {
    const label = `${element.getAttribute?.("aria-label") || ""} ${element.getAttribute?.("placeholder") || ""}`;
    return /message|chat|reply/i.test(label) || Boolean(element.closest?.('[role="dialog"]'));
  });
}

function fillComposer(composer, message) {
  composer.focus();
  if (composer instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(composer, message);
    composer.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    document.execCommand("selectAll", false);
    document.execCommand("insertText", false, message);
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: message }));
  }
}

function installSendListener() {
  if (sendListenerInstalled) return;
  sendListenerInstalled = true;
  document.addEventListener("click", (event) => {
    if (!activeAttempt) return;
    const target = event.target?.closest?.("button");
    if (!target) return;
    const label = `${target.textContent || ""} ${target.getAttribute("aria-label") || ""} ${target.getAttribute("title") || ""}`;
    if (!/\bsend\b/i.test(label)) return;
    const attempt = activeAttempt;
    void confirmNativeSend(attempt);
  }, true);
}

async function confirmNativeSend(attempt) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const composer = findChatComposer();
    const composerText = composer instanceof HTMLTextAreaElement ? composer.value : composer?.textContent || "";
    const matchingBubble = deepQueryAll("p, span, div").some((element) =>
      !element.closest?.("#redbot-outreach-overlay")
      && !element.closest?.('textarea, [contenteditable="true"]')
      && (element.textContent || "").trim() === attempt.message.trim(),
    );
    if (!composerText.trim() && matchingBubble) {
      chrome.runtime.sendMessage({ type: "REDDIT_DECISION", attemptId: attempt.id, decision: "sent" });
      return;
    }
    await delay(500);
  }
  const note = document.querySelector("#redbot-outreach-overlay .redbot-note");
  if (note) note.textContent = "Send could not be confirmed automatically. Verify the chat, then use Mark sent or Skip.";
}

function renderOverlay(attempt) {
  document.getElementById("redbot-outreach-overlay")?.remove();
  const root = document.createElement("aside");
  root.id = "redbot-outreach-overlay";
  root.innerHTML = `
    <div class="redbot-kicker">RedBot outreach</div>
    <div class="redbot-title">Review message for u/${escapeHtml(attempt.username)}</div>
    <textarea readonly aria-label="Prepared Reddit outreach message"></textarea>
    <div class="redbot-note">Review the text, then click Reddit's native Send button. Use Mark sent only if detection fails.</div>
    <div class="redbot-actions">
      <button data-action="copy">Copy</button>
      <button data-action="sent" class="primary">Mark sent</button>
      <button data-action="skip">Skip</button>
      <button data-action="block">Do not contact</button>
    </div>`;
  root.querySelector("textarea").value = attempt.message;
  root.addEventListener("click", async (event) => {
    const action = event.target?.getAttribute?.("data-action");
    if (!action) return;
    if (action === "copy") {
      await navigator.clipboard.writeText(attempt.message);
      event.target.textContent = "Copied";
      return;
    }
    chrome.runtime.sendMessage({
      type: "REDDIT_DECISION",
      attemptId: attempt.id,
      decision: action === "sent" ? "sent" : "skip",
      doNotContact: action === "block",
    });
  });
  document.documentElement.appendChild(root);
}

function deepQuery(selector) { return deepQueryAll(selector)[0] || null; }
function deepQueryAll(selector) {
  const results = [];
  const roots = [document];
  for (let index = 0; index < roots.length; index += 1) {
    const root = roots[index];
    results.push(...root.querySelectorAll(selector));
    root.querySelectorAll("*").forEach((element) => { if (element.shadowRoot) roots.push(element.shadowRoot); });
  }
  return [...new Set(results)];
}
function readUsername(element) {
  const href = element?.querySelector?.('a[href*="/user/"]')?.getAttribute("href") || "";
  return href.match(/\/user\/([^/]+)/i)?.[1] || "";
}
async function waitFor(getter, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = getter();
    if (value) return value;
    await delay(500);
  }
  throw new Error("Timed out waiting for Reddit.");
}
function escapeHtml(value) { const node = document.createElement("div"); node.textContent = String(value); return node.innerHTML; }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
