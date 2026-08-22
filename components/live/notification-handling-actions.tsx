"use client";

import { CheckCheck, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { markAllNotificationsHandled, markNotificationHandled } from "@/actions/live-mode";
import { useToast } from "@/components/ui/use-toast";

export function NotificationHandlingButton({ notificationId }: { notificationId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  return <button className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full bg-[#1f1f1f] px-3 text-[9px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#292929] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} onClick={() => startTransition(async () => { const result = await markNotificationHandled(notificationId); toast({ title: result.status === "success" ? "Notification handled" : "Could not update notification", description: result.message, variant: result.status === "error" ? "destructive" : undefined }); if (result.status === "success") router.refresh(); })} type="button">{pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}Mark handled</button>;
}

export function MarkAllNotificationsHandledButton({ disabled }: { disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  return <button className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-[#1ed760] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#0d160f] transition-colors hover:bg-[#3be477] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ed760]/70 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled || pending} onClick={() => startTransition(async () => { const result = await markAllNotificationsHandled(); toast({ title: result.status === "success" ? "Notifications handled" : "Could not update notifications", description: result.message, variant: result.status === "error" ? "destructive" : undefined }); if (result.status === "success") router.refresh(); })} type="button">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}{pending ? "Updating..." : "Mark all handled"}</button>;
}
