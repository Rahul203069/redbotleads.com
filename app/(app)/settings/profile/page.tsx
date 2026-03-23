import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app/app-header";
import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { auth } from "@/lib/auth";

export default async function ProfileSettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <AppHeader
        eyebrow="Profile"
        title="Profile settings"
        description="Your account identity inside this workspace."
      />

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
    <div className="rounded-[24px] border border-[#27272a] bg-[#111113] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
      <div className="text-xs uppercase tracking-[0.24em] text-[#71717a]">{label}</div>
      <div className="mt-4 text-lg font-medium text-[#fafafa]">{value}</div>
    </div>
  );
}
