"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Laptop, LoaderCircle, Pause, Play, RefreshCw, Settings2, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type DateFilter = { date?: string[]; from?: string; range?: string; to?: string };
type Settings = {
  firstTouchInstructions: string;
  firstTouchExamples: string;
  followUpInstructions: string;
  followUpExamples: string;
};
type OutreachRun = {
  id: string;
  status: "QUEUED" | "RUNNING" | "PAUSED" | "LIMIT_REACHED" | "COMPLETED" | "STOPPED" | "FAILED";
  counts: {
    queuedPosts: number;
    analyzedPosts: number;
    draftedMessages: number;
    sentMessages: number;
    skippedMessages: number;
    failedMessages: number;
  };
  posts: Array<{ id: string; status: string; redditItem: { title: string | null; subreddit: string; url: string | null } }>;
  attempts: Array<{ id: string; username: string; stage: string; status: string; error: string | null }>;
  lastError: string | null;
};

const DEFAULT_SETTINGS: Settings = {
  firstTouchInstructions: "Write a concise, specific introduction that references the service the commenter offers. Be helpful and low pressure.",
  firstTouchExamples: "Saw your comment about offering [service]. I found a few relevant opportunities you may want to review: [public link]",
  followUpInstructions: "Write one respectful follow-up. Mention the earlier note without implying that the recipient owes a reply.",
  followUpExamples: "Quick follow-up in case this is useful for your work—these opportunities are still available here: [public link]",
};

export function OutreachAssistantDialog({
  campaignId,
  campaignName,
  dateFilter,
}: {
  campaignId: string;
  campaignName: string;
  dateFilter: DateFilter;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"SETUP" | "RUN">("SETUP");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [redditUsername, setRedditUsername] = useState("");
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [run, setRun] = useState<OutreachRun | null>(null);
  const [allowance, setAllowance] = useState(25);

  const publicLeadsUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(`/share/leads/${campaignId}`, window.location.origin);
    if (dateFilter.range === "all") url.searchParams.set("range", "all");
    else if (dateFilter.date?.length) dateFilter.date.forEach((date) => url.searchParams.append("date", date));
    else if (dateFilter.from && dateFilter.to) {
      url.searchParams.set("from", dateFilter.from);
      url.searchParams.set("to", dateFilter.to);
    }
    return url.toString();
  }, [campaignId, dateFilter]);

  const pingExtension = useCallback(() => {
    window.postMessage({ source: "redbot-web", type: "OUTREACH_PING" }, window.location.origin);
  }, []);

  const showError = useCallback((error: unknown) => {
    toast({ title: "Outreach assistant", description: error instanceof Error ? error.message : "Something went wrong.", variant: "destructive" });
  }, [toast]);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/outreach/campaigns/${encodeURIComponent(campaignId)}/settings`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load outreach settings.");
      setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      setRedditUsername(data.redditUsername || "");
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, showError]);

  const refreshRun = useCallback(async (runId: string) => {
    try {
      const response = await fetch(`/api/admin/outreach/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not refresh the run.");
      setRun(data.run);
      setAllowance(data.allowance);
    } catch (error) {
      showError(error);
    }
  }, [showError]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin || event.data?.source !== "redbot-extension") return;
      if (event.data.type === "OUTREACH_PONG") setExtensionVersion(String(event.data.version || "installed"));
      if (event.data.type === "OUTREACH_RUN_UPDATE" && run?.id && event.data.runId === run.id) void refreshRun(run.id);
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refreshRun, run?.id]);

  useEffect(() => {
    if (!open) return;
    pingExtension();
    void loadSettings();
    const pingTimer = window.setTimeout(pingExtension, 600);
    return () => window.clearTimeout(pingTimer);
  }, [loadSettings, open, pingExtension]);

  useEffect(() => {
    if (!open || !run || !["RUNNING", "QUEUED", "PAUSED", "LIMIT_REACHED"].includes(run.status)) return;
    const timer = window.setInterval(() => void refreshRun(run.id), 2500);
    return () => window.clearInterval(timer);
  }, [open, refreshRun, run]);

  async function saveSettings() {
    const response = await fetch(`/api/admin/outreach/campaigns/${encodeURIComponent(campaignId)}/settings`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save outreach settings.");
    return data;
  }

  async function handleSave() {
    setIsLoading(true);
    try {
      await saveSettings();
      toast({ title: "Outreach settings saved", description: "The laptop assistant will use these instructions and examples." });
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStart() {
    if (!extensionVersion) {
      toast({ title: "Chrome extension not detected", description: "Load the browser-extension folder in Chrome, then retry the preflight.", variant: "destructive" });
      return;
    }
    if (!redditUsername.trim()) {
      toast({ title: "Reddit username required", description: "Enter the account currently signed in to Reddit.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      await saveSettings();
      const response = await fetch("/api/admin/outreach/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId, redditUsername, publicLeadsUrl, dateFilter, extensionVersion }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.runId) {
          await refreshRun(data.runId);
          setView("RUN");
        }
        throw new Error(data.error || "Could not start outreach.");
      }
      setRun(data.run);
      setView("RUN");
      window.postMessage({ source: "redbot-web", type: "OUTREACH_START", runId: data.run.id }, window.location.origin);
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function updateRun(action: "pause" | "resume" | "stop") {
    if (!run) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/outreach/runs/${encodeURIComponent(run.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update the run.");
      setRun(data.run);
      window.postMessage({ source: "redbot-web", type: `OUTREACH_${action.toUpperCase()}`, runId: run.id }, window.location.origin);
    } catch (error) {
      showError(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full cursor-pointer sm:w-auto" variant="secondary">
          <Bot aria-hidden="true" className="h-4 w-4" />
          Outreach
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <div className="border-b border-white/8 px-5 py-5 sm:px-7">
          <DialogHeader>
            <div className="flex items-center gap-2 text-[#55e982]"><Laptop className="h-4 w-4" /><span className="text-[10px] font-bold uppercase tracking-[0.2em]">Local browser assistant</span></div>
            <DialogTitle>Reddit outreach · {campaignName}</DialogTitle>
            <DialogDescription>ChatGPT drafts each message. The extension fills Reddit Chat, but only you can click Send.</DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Outreach assistant views">
            <TabButton active={view === "SETUP"} onClick={() => setView("SETUP")}><Settings2 className="h-4 w-4" />Setup</TabButton>
            <TabButton active={view === "RUN"} disabled={!run} onClick={() => setView("RUN")}><RefreshCw className="h-4 w-4" />Run</TabButton>
          </div>
        </div>

        {view === "SETUP" ? (
          <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-5">
              <SettingsField label="First-touch instructions" hint="Tell ChatGPT how to introduce the campaign and what tone to use.">
                <Textarea value={settings.firstTouchInstructions} onChange={(event) => setSettings((current) => ({ ...current, firstTouchInstructions: event.target.value }))} />
              </SettingsField>
              <SettingsField label="First-touch examples" hint="Examples guide style; the leads-only link is inserted automatically.">
                <Textarea value={settings.firstTouchExamples} onChange={(event) => setSettings((current) => ({ ...current, firstTouchExamples: event.target.value }))} />
              </SettingsField>
              <SettingsField label="Follow-up instructions" hint="Used once, only after seven days have passed.">
                <Textarea value={settings.followUpInstructions} onChange={(event) => setSettings((current) => ({ ...current, followUpInstructions: event.target.value }))} />
              </SettingsField>
              <SettingsField label="Follow-up examples" hint="Keep it respectful and low pressure.">
                <Textarea value={settings.followUpExamples} onChange={(event) => setSettings((current) => ({ ...current, followUpExamples: event.target.value }))} />
              </SettingsField>
            </div>
            <aside className="space-y-4 rounded-[22px] border border-white/8 bg-[#111113] p-5">
              <StatusRow good={Boolean(extensionVersion)} label="Chrome extension" value={extensionVersion ? `Connected · v${extensionVersion}` : "Not detected"} />
              <SettingsField label="Signed-in Reddit username" hint="No password or Reddit token is stored.">
                <Input placeholder="your_username" value={redditUsername} onChange={(event) => setRedditUsername(event.target.value)} />
              </SettingsField>
              <div className="rounded-[16px] border border-[#1ed760]/20 bg-[#1ed760]/8 p-4 text-[12px] leading-5 text-[#cbcbcb]">
                <strong className="text-white">Run limits</strong><br />75+ score · top 100 comments · 25 sends per rolling 24 hours · one follow-up maximum.
              </div>
              <div className="grid gap-2">
                <Button className="cursor-pointer" disabled={isLoading} onClick={handleStart}>
                  {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Start outreach
                </Button>
                <Button className="cursor-pointer" disabled={isLoading} onClick={handleSave} variant="secondary">Save settings</Button>
                <Button className="cursor-pointer" onClick={pingExtension} variant="ghost"><RefreshCw className="h-4 w-4" />Retry preflight</Button>
              </div>
            </aside>
          </div>
        ) : run ? (
          <div className="space-y-5 p-5 sm:p-7">
            <div className="flex flex-col gap-4 rounded-[22px] border border-white/8 bg-[#111113] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#858585]">Run status</p><div className="mt-2 flex items-center gap-2 text-lg font-semibold text-white"><RunStatusIcon status={run.status} />{formatStatus(run.status)}</div></div>
              <div className="flex flex-wrap gap-2">
                {run.status === "RUNNING" ? <Button className="cursor-pointer" disabled={isLoading} onClick={() => updateRun("pause")} variant="secondary"><Pause className="h-4 w-4" />Pause</Button> : null}
                {["PAUSED", "LIMIT_REACHED"].includes(run.status) ? <Button className="cursor-pointer" disabled={isLoading} onClick={() => updateRun("resume")}><Play className="h-4 w-4" />Resume</Button> : null}
                {["RUNNING", "PAUSED", "LIMIT_REACHED"].includes(run.status) ? <Button className="cursor-pointer" disabled={isLoading} onClick={() => updateRun("stop")} variant="ghost"><Square className="h-4 w-4" />Stop</Button> : null}
                <Button className="cursor-pointer" onClick={() => refreshRun(run.id)} variant="ghost"><RefreshCw className="h-4 w-4" />Refresh</Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Metric label="Posts" value={`${run.counts.analyzedPosts}/${run.counts.queuedPosts}`} />
              <Metric label="Drafts" value={run.counts.draftedMessages} />
              <Metric label="Sent" value={run.counts.sentMessages} good />
              <Metric label="Skipped" value={run.counts.skippedMessages} />
              <Metric label="Failed" value={run.counts.failedMessages} />
              <Metric label="24h left" value={allowance} good />
            </div>
            {run.lastError ? <div className="flex gap-3 rounded-[18px] border border-red-500/25 bg-red-500/8 p-4 text-sm text-red-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{run.lastError}</div> : null}
            <div className="grid gap-5 lg:grid-cols-2">
              <RunList title="Posts" empty="No qualifying posts in this date range.">{run.posts.map((post) => <RunListRow key={post.id} label={post.redditItem.title || `r/${post.redditItem.subreddit}`} status={post.status} />)}</RunList>
              <RunList title="Recipients" empty="No message drafts yet.">{run.attempts.map((attempt) => <RunListRow key={attempt.id} label={`u/${attempt.username} · ${formatStatus(attempt.stage)}`} status={attempt.status} />)}</RunList>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SettingsField({ children, hint, label }: { children: React.ReactNode; hint: string; label: string }) {
  return <label className="grid gap-2"><span className="text-sm font-semibold text-white">{label}</span>{children}<span className="text-[12px] leading-5 text-[#929292]">{hint}</span></label>;
}
function TabButton({ active, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return <button {...props} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40 ${active ? "bg-white text-black" : "bg-[#18181b] text-[#b3b3b3] hover:text-white"}`} type="button">{children}</button>;
}
function StatusRow({ good, label, value }: { good: boolean; label: string; value: string }) {
  return <div className="flex items-start gap-3"><div className={`mt-1 h-2.5 w-2.5 rounded-full ${good ? "bg-[#55e982]" : "bg-amber-400"}`} /><div><p className="text-xs font-semibold text-white">{label}</p><p className="mt-1 text-[12px] text-[#929292]">{value}</p></div></div>;
}
function Metric({ good, label, value }: { good?: boolean; label: string; value: number | string }) {
  return <div className="rounded-[18px] border border-white/8 bg-[#111113] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#858585]">{label}</p><p className={`mt-2 text-2xl font-bold ${good ? "text-[#55e982]" : "text-white"}`}>{value}</p></div>;
}
function RunList({ children, empty, title }: { children: React.ReactNode; empty: string; title: string }) {
  const items = Array.isArray(children) ? children : [children];
  return <section className="rounded-[22px] border border-white/8 bg-[#111113] p-5"><h3 className="font-semibold text-white">{title}</h3><div className="mt-4 space-y-2">{items.filter(Boolean).length ? children : <p className="text-sm text-[#929292]">{empty}</p>}</div></section>;
}
function RunListRow({ label, status }: { label: string; status: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-[14px] bg-[#18181b] px-3 py-3"><span className="min-w-0 truncate text-sm text-[#e4e4e7]">{label}</span><span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[#929292]">{formatStatus(status)}</span></div>;
}
function RunStatusIcon({ status }: { status: OutreachRun["status"] }) {
  if (status === "COMPLETED") return <CheckCircle2 className="h-5 w-5 text-[#55e982]" />;
  if (["FAILED", "LIMIT_REACHED"].includes(status)) return <AlertTriangle className="h-5 w-5 text-amber-400" />;
  return <LoaderCircle className={`h-5 w-5 text-[#55e982] ${status === "RUNNING" ? "animate-spin motion-reduce:animate-none" : ""}`} />;
}
function formatStatus(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
