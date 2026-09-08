import type { ClientNotificationChannel } from "@/lib/notification-recipients";

export function NotificationSetupBadge({
  channel,
}: {
  channel: ClientNotificationChannel | null;
}) {
  const label = channel === "TELEGRAM"
    ? "Telegram connected"
    : channel === "SLACK"
      ? "Slack connected"
      : "Notifications not set up";
  const className = channel === "TELEGRAM"
    ? "bg-[#102742] text-[#8fc8ff] shadow-[rgb(59,130,246)_0px_0px_0px_1px_inset]"
    : channel === "SLACK"
      ? "bg-[#2d1b34] text-[#efb5ff] shadow-[rgb(192,132,252)_0px_0px_0px_1px_inset]"
      : "bg-[#3a151b] text-[#ff9aa5] shadow-[rgb(243,114,127)_0px_0px_0px_1px_inset]";

  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${className}`}>
      {label}
    </span>
  );
}
