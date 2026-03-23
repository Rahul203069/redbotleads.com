import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { auth } from "@/lib/auth";

export default async function BillingSettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <AppHeader
        eyebrow="Billing"
        title="Billing"
        description="Current plan state and future billing controls."
      />

      <SettingsBackLink />

      <div className="rounded-[24px] border border-[#27272a] bg-[#111113] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
        <div className="text-xs uppercase tracking-[0.24em] text-[#71717a]">Plan</div>
        <div className="mt-4 text-2xl font-semibold text-[#fafafa] capitalize">{session.user.plan}</div>
        <p className="mt-4 text-sm leading-7 text-[#a1a1aa]">
          Billing management is not active yet. This section is reserved for plan upgrades, invoices, and payment
          controls.
        </p>
      </div>
    </div>
  );
}
