const STATE_KEY = "redbotOutreachState";
let processing = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OUTREACH_START") {
    saveState({ runId: message.runId, appOrigin: message.appOrigin, appTabId: sender.tab?.id, paused: false })
      .then(() => processRun());
  } else if (message.type === "OUTREACH_RESUME") {
    updateState({
      runId: message.runId,
      appOrigin: message.appOrigin,
      appTabId: sender.tab?.id,
      paused: false,
    }).then(() => processRun());
  } else if (message.type === "OUTREACH_APP_READY") {
    updateState({ appOrigin: message.appOrigin, appTabId: sender.tab?.id });
  } else if (message.type === "OUTREACH_PAUSE") {
    updateState({ paused: true });
  } else if (message.type === "OUTREACH_STOP") {
    clearWorkState();
  } else if (message.type === "REDDIT_TAB_READY") {
    restoreApprovalOnTab(sender.tab?.id);
  } else if (message.type === "REDDIT_DECISION") {
    handleRedditDecision(message, sender.tab?.id);
  }
  sendResponse?.({ ok: true });
});

chrome.runtime.onStartup.addListener(() => processRun());

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (state.approvalTabId === tabId && state.currentAttempt) {
    await updateState({ approvalTabId: null });
    await api(`/api/admin/outreach/runs/${state.runId}`, { method: "PATCH", body: { action: "pause" } }).catch(() => null);
    await notify(state.runId);
  }
});

async function processRun() {
  if (processing) return;
  processing = true;
  try {
    const state = await getState();
    if (!state.runId || state.paused || state.currentAttempt) return;
    const response = await api(`/api/admin/outreach/runs/${state.runId}`);
    if (!response.ok) throw new Error(response.data.error || "Could not load the outreach run.");
    const run = response.data.run;
    if (run.status !== "RUNNING") return;

    const awaiting = run.attempts.find((attempt) => attempt.status === "AWAITING_APPROVAL");
    if (awaiting) {
      await prepareRecipient(awaiting, run.id);
      return;
    }

    const post = run.posts.find((item) => item.status === "QUEUED");
    if (!post) {
      await notify(run.id);
      return;
    }
    await processPost(run, post);
  } catch (error) {
    const state = await getState();
    if (state.runId) {
      const latest = await api(`/api/admin/outreach/runs/${state.runId}`).catch(() => null);
      if (latest?.data?.run?.status !== "LIMIT_REACHED") {
        await api(`/api/admin/outreach/runs/${state.runId}`, {
          method: "PATCH",
          body: { action: "pause", error: error instanceof Error ? error.message : "The browser workflow paused unexpectedly." },
        }).catch(() => null);
      }
      await notify(state.runId);
    }
  } finally {
    processing = false;
  }
}

async function processPost(run, runPost) {
  const scanTab = await chrome.tabs.create({ url: withTopSort(runPost.redditItem.url), active: true });
  const scan = await sendToTabWithRetry(scanTab.id, { type: "SCAN_REDDIT_POST", limit: 100 }, 30);
  await safeClose(scanTab.id);
  if (!scan?.post || !Array.isArray(scan.comments)) throw new Error("Reddit post could not be scanned.");

  const authors = [...new Map(scan.comments.map((comment) => [normalizeUsername(comment.username), { username: comment.username }])).values()];
  const eligibilityResponse = await api(`/api/admin/outreach/runs/${run.id}/eligibility`, {
    method: "POST",
    body: { runPostId: runPost.id, authors },
  });
  if (!eligibilityResponse.ok) throw new Error(eligibilityResponse.data.error || "Could not check recipients.");
  const context = eligibilityResponse.data;
  const eligible = new Map(context.authors.filter((author) => author.eligible).map((author) => [author.normalizedUsername, author]));
  const eligibleComments = scan.comments.filter((comment) => eligible.has(normalizeUsername(comment.username)));
  if (!eligibleComments.length) {
    await api(`/api/admin/outreach/runs/${run.id}/drafts`, { method: "POST", body: { runPostId: runPost.id, drafts: [] } });
    await notify(run.id);
    queueNext();
    return;
  }

  const prompt = buildPrompt(scan.post, eligibleComments, eligible, context);
  const chatTab = await chrome.tabs.create({ url: "https://chatgpt.com/", active: true });
  let generated = await sendToTabWithRetry(chatTab.id, { type: "GENERATE_OUTREACH", prompt }, 30);
  let parsed = parseChatGptJson(generated?.text);
  if (!parsed) {
    generated = await sendToTabWithRetry(chatTab.id, {
      type: "GENERATE_OUTREACH",
      prompt: "Repair your previous response. Return only valid JSON with a recipients array and no markdown.",
    }, 10);
    parsed = parseChatGptJson(generated?.text);
  }
  await safeClose(chatTab.id);
  if (!parsed) throw new Error("ChatGPT did not return valid outreach JSON.");

  const commentById = new Map(eligibleComments.map((comment) => [comment.id, comment]));
  const drafts = (parsed.recipients || []).flatMap((recipient) => {
    const username = normalizeUsername(recipient.username || "");
    const author = eligible.get(username);
    const source = commentById.get(recipient.sourceCommentId) || eligibleComments.find((comment) => normalizeUsername(comment.username) === username);
    if (!author || !source || typeof recipient.message !== "string") return [];
    return [{
      username: source.username,
      sourceCommentId: source.id,
      sourceCommentUrl: source.permalink,
      stage: author.stage,
      qualificationReason: String(recipient.qualificationReason || "The comment promotes the user's own service.").slice(0, 500),
      message: ensurePublicLink(recipient.message, context.publicLeadsUrl),
    }];
  }).slice(0, context.allowance);
  const draftResponse = await api(`/api/admin/outreach/runs/${run.id}/drafts`, {
    method: "POST",
    body: { runPostId: runPost.id, drafts },
  });
  if (!draftResponse.ok && draftResponse.status !== 409) throw new Error(draftResponse.data.error || "Could not save message drafts.");
  await notify(run.id);
  queueNext();
}

async function prepareRecipient(attempt, runId) {
  const tab = await chrome.tabs.create({ url: `https://www.reddit.com/user/${encodeURIComponent(attempt.username)}/`, active: true });
  await updateState({ currentAttempt: attempt, approvalTabId: tab.id });
  await sendToTabWithRetry(tab.id, { type: "PREPARE_REDDIT_CHAT", attempt }, 30).catch(() => null);
  await notify(runId);
}

async function restoreApprovalOnTab(tabId) {
  const state = await getState();
  if (!tabId || !state.currentAttempt) return;
  await updateState({ approvalTabId: tabId });
  chrome.tabs.sendMessage(tabId, { type: "PREPARE_REDDIT_CHAT", attempt: state.currentAttempt }).catch(() => null);
}

async function handleRedditDecision(message, tabId) {
  const state = await getState();
  if (!state.currentAttempt || message.attemptId !== state.currentAttempt.id) return;
  const status = message.decision === "sent" ? "SENT" : "SKIPPED";
  const response = await api(`/api/admin/outreach/attempts/${state.currentAttempt.id}`, {
    method: "PATCH",
    body: { status, doNotContact: Boolean(message.doNotContact) },
  });
  if (!response.ok) {
    if (response.status !== 429) {
      await api(`/api/admin/outreach/runs/${state.runId}`, {
        method: "PATCH",
        body: { action: "pause", error: response.data.error || "The send result could not be recorded." },
      }).catch(() => null);
    }
  }
  await updateState({ currentAttempt: null, approvalTabId: null });
  if (tabId) await safeClose(tabId);
  await notify(state.runId);
  queueNext();
}

function buildPrompt(post, comments, eligible, context) {
  const recipients = [...eligible.values()].map((author) => ({ username: author.username, stage: author.stage }));
  return [
    "You are preparing respectful, personalized Reddit outreach for a human operator.",
    "Select only commenters who clearly promote, offer, or pitch their own product or service.",
    "Do not select casual participants, likely buyers, the post author, bots, or deleted accounts.",
    "Every message must be plain text, no more than 500 characters, make no unsupported claims, and contain the exact public link once.",
    "Return ONLY JSON in this form: {\"recipients\":[{\"username\":\"...\",\"sourceCommentId\":\"...\",\"qualificationReason\":\"...\",\"message\":\"...\"}]}",
    `Campaign: ${context.campaign.name}`,
    `Campaign description: ${context.campaign.description || "Not provided"}`,
    `Public link: ${context.publicLeadsUrl}`,
    `First-touch instructions: ${context.settings.firstTouchInstructions}`,
    `First-touch examples: ${context.settings.firstTouchExamples || "None"}`,
    `Follow-up instructions: ${context.settings.followUpInstructions}`,
    `Follow-up examples: ${context.settings.followUpExamples || "None"}`,
    `Eligible stages: ${JSON.stringify(recipients)}`,
    `Reddit post: ${JSON.stringify(post)}`,
    `Comments: ${JSON.stringify(comments)}`,
  ].join("\n\n");
}

function parseChatGptJson(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed.recipients) ? parsed : null;
  } catch { return null; }
}

function ensurePublicLink(message, url) {
  let body = String(message).split(url).join("").trim();
  const suffix = ` ${url}`;
  const maximumBodyLength = Math.max(0, 500 - suffix.length);
  if (body.length > maximumBodyLength) body = `${body.slice(0, Math.max(0, maximumBodyLength - 1)).trim()}…`;
  return `${body}${suffix}`.trim();
}

function normalizeUsername(value) {
  return String(value).trim().replace(/^u\//i, "").replace(/^@/, "").toLowerCase();
}

function withTopSort(value) {
  const url = new URL(value);
  url.searchParams.set("sort", "top");
  return url.toString();
}

async function api(path, options = {}) {
  const state = await getState();
  if (!state.appTabId) throw new Error("The campaign tab is no longer connected.");
  return chrome.tabs.sendMessage(state.appTabId, { type: "APP_API_FETCH", path, ...options });
}

async function sendToTabWithRetry(tabId, message, attempts) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try { return await chrome.tabs.sendMessage(tabId, message); }
    catch (error) { lastError = error; await delay(1000); }
  }
  throw lastError || new Error("The browser tab did not become ready.");
}

async function notify(runId) {
  const state = await getState();
  if (state.appTabId) await chrome.tabs.sendMessage(state.appTabId, { type: "OUTREACH_NOTIFY", runId }).catch(() => null);
}

function queueNext() { setTimeout(() => processRun(), 500); }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function safeClose(tabId) { if (tabId) await chrome.tabs.remove(tabId).catch(() => null); }
async function getState() { return (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] || {}; }
async function saveState(state) { await chrome.storage.local.set({ [STATE_KEY]: state }); }
async function updateState(patch) { await saveState({ ...(await getState()), ...patch }); }
async function clearWorkState() { const state = await getState(); await saveState({ appOrigin: state.appOrigin, appTabId: state.appTabId }); }
