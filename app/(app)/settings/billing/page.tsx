import { redirect } from "next/navigation";

import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { auth } from "@/lib/auth";

export default async function BillingSettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="max-w-2xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">
            Billing
          </p>
          <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.5rem]">
            Billing
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-[#cbcbcb]">
            Current plan state and future billing controls.
          </p>
        </div>
      </section>

      <SettingsBackLink />

      <div className="rounded-[22px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Plan</div>
        <div className="mt-4 text-[24px] font-bold capitalize text-[#fdfdfd]">{session.user.plan}</div>
        <p className="mt-4 text-[14px] leading-6 text-[#cbcbcb]">
          Billing management is not active yet. This section is reserved for plan upgrades,
          invoices, and payment controls.
        </p>
      </div>
    </div>
  );
}
