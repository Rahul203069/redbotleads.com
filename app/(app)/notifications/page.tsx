import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Bell, ExternalLink } from "lucide-react";

import { MarkAllNotificationsHandledButton, NotificationHandlingButton } from "@/components/live/notification-handling-actions";
import { auth } from "@/lib/auth";
import { getLiveNotifications, type LiveNotificationFilter } from "@/lib/live-leads";
import { getSaasConfig } from "@/lib/saas-config";

const filters: Array<{ label: string; value: LiveNotificationFilter }> = [
  { label: "All", value: "ALL" },
  { label: "Unhandled", value: "UNHANDLED" },
  { label: "Handled", value: "HANDLED" },
  { label: "Pending", value: "PENDING" },
  { label: "Failed", value: "FAILED" },
];

export default async function NotificationsPage({ searchParams }: { searchParams?: Promise<{ cursor?: string; filter?: string }> | { cursor?: string; filter?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const config = await getSaasConfig();
  if (config.appMode !== "LIVE") redirect("/settings/notifcation");
  const params = await Promise.resolve(searchParams ?? {});
  const filter = filters.some((item) => item.value === params.filter) ? params.filter as LiveNotificationFilter : "ALL";
  const result = await getLiveNotifications({ userId: session.user.id, filter, cursor: params.cursor });

  return <div className="space-y-5">
    <section className="rounded-[28px] border border-white/[0.06] bg-[#181818] p-6 lg:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-[#55e982]"><Bell className="h-4 w-4" /><p className="text-[10px] font-bold uppercase tracking-[0.2em]">Delivery center</p></div><h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-white lg:text-[2.5rem]">Notifications</h1><p className="mt-2 text-[14px] leading-6 text-[#a7a7a7]">Audit delivery and keep track of alerts you have already handled.</p></div><MarkAllNotificationsHandledButton disabled={result.unhandledCount === 0} /></div></section>
    <section className="rounded-[24px] border border-white/[0.06] bg-[#181818] p-4 sm:p-5">
      <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-white/[0.07] pb-4">{filters.map((item) => <Link aria-current={filter === item.value ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-full px-3.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 ${filter === item.value ? "bg-[#1ed760] text-[#0d160f]" : "bg-[#101010] text-[#a7a7a7] hover:bg-[#252525] hover:text-white"}`} href={item.value === "ALL" ? "/notifications" : `/notifications?filter=${item.value}`} key={item.value}>{item.label}{item.value === "UNHANDLED" ? ` ${result.unhandledCount}` : ""}</Link>)}</div>
      <div className="space-y-3 pt-5">{result.notifications.length ? result.notifications.map((notification) => {
        const title = notification.lead.redditItem.title || notification.lead.redditItem.body || "Reddit lead";
        return <article className={`rounded-[18px] border p-4 sm:p-5 ${notification.handledAt ? "border-white/[0.07] bg-[#111111]" : "border-[#1ed760]/30 bg-[#111811]"}`} key={notification.id}><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><StateBadge value={notification.status} /><span className="rounded-full bg-[#1f1f1f] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#c7c7c7]">{notification.channel}</span><span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#777]">{notification.handledAt ? "Handled" : "Unhandled"}</span></div><h2 className="mt-3 text-[15px] font-bold leading-6 text-white">{title}</h2><p className="mt-1 text-[12px] text-[#8f8f8f]">{notification.campaignDisplayName} · r/{notification.lead.redditItem.subreddit} · {notification.lead.score}% match</p><p className="mt-2 text-[11px] text-[#737373]">Created {new Date(notification.createdAt).toLocaleString()} {notification.sentAt ? `· Sent ${new Date(notification.sentAt).toLocaleString()}` : ""}</p>{notification.error ? <p className="mt-3 flex items-start gap-2 rounded-[12px] bg-[#3a151b] p-3 text-[11px] leading-5 text-[#ffb0b8]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{notification.error}</p> : null}</div><div className="flex shrink-0 flex-wrap gap-2"><Link className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full bg-[#1ed760] px-3 text-[9px] font-bold uppercase tracking-[0.12em] text-[#0d160f] hover:bg-[#3be477] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70" href={`/inbox?status=ALL&campaign=${notification.lead.campaignId}&lead=${notification.lead.id}`}><ExternalLink className="h-3.5 w-3.5" />Open lead</Link>{!notification.handledAt ? <NotificationHandlingButton notificationId={notification.id} /> : null}</div></div></article>;
      }) : <div className="rounded-[18px] border border-dashed border-white/[0.12] bg-[#111111] p-10 text-center"><p className="text-[16px] font-bold text-white">No notifications in this view</p><p className="mt-2 text-[13px] text-[#8f8f8f]">Delivery records will appear here as the existing notification pipeline runs.</p></div>}</div>
      {result.nextCursor ? <div className="mt-5 flex justify-center border-t border-white/[0.07] pt-5"><Link className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-[#1f1f1f] px-5 text-[10px] font-bold uppercase tracking-[0.12em] text-white hover:bg-[#292929]" href={`/notifications?filter=${filter}&cursor=${result.nextCursor}`}>Load older notifications</Link></div> : null}
    </section>
  </div>;
}

function StateBadge({ value }: { value: "PENDING" | "SENT" | "FAILED" }) { const tone = value === "SENT" ? "bg-[#1ed760]/15 text-[#73f5a0]" : value === "FAILED" ? "bg-[#3a151b] text-[#ff9aa5]" : "bg-[#3b2d10] text-[#ffd66e]"; return <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.13em] ${tone}`}>{value}</span>; }
