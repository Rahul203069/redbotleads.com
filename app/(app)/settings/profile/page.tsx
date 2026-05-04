import { redirect } from "next/navigation";

import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { auth } from "@/lib/auth";

export default async function ProfileSettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[#181818] p-6 shadow-[rgba(0,0,0,0.5)_0px_8px_24px] lg:p-8">
        <div className="max-w-2xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">
            Profile
          </p>
          <h1 className="mt-3 text-[2rem] font-bold tracking-[-0.04em] text-[#fdfdfd] lg:text-[2.5rem]">
            Profile settings
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-[#cbcbcb]">
            Your account identity inside this workspace.
          </p>
        </div>
      </section>

      <SettingsBackLink />

      <div className="grid gap-5 lg:grid-cols-2">
        <ProfileField label="Username" value={session.user.name ?? "No username set"} />
        <ProfileField label="Email" value={session.user.email ?? "No email available"} />
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-[#1f1f1f] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">{label}</div>
      <div className="mt-4 text-[18px] font-semibold text-[#fdfdfd]">{value}</div>
    </div>
  );
}
