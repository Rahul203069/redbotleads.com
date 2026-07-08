import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";

import { revokeCampaignClientAccess } from "@/app/(app)/admin/analytics/onboarding/actions";
import { CampaignClientOnboardingForm } from "@/components/admin/campaign-client-onboarding-form";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/beta-access";
import { prisma } from "@/lib/prisma";

export default async function CampaignClientOnboardingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!canViewAnalytics(session.user.email)) {
    redirect("/app");
  }

  const [campaigns, accesses] = await Promise.all([
    prisma.campaign.findMany({
      select: {
        id: true,
        name: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.campaignClientAccess.findMany({
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return (
    <div className="space-y-5 text-[#ffffff]">
      <section className="rounded-[24px] bg-[#181818] px-5 py-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:px-6 lg:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <Link
              className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#121212] px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#cbcbcb] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] transition-colors hover:bg-[#252525] hover:text-[#ffffff]"
              href="/admin/analytics"
            >
              <ArrowLeft className="h-4 w-4" />
              Admin
            </Link>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Client onboarding</p>
            <h1 className="mt-2 flex items-center gap-3 text-[1.85rem] font-bold text-[#ffffff] lg:text-[2.2rem]">
              <UserPlus className="h-7 w-7 text-[#1ed760]" />
              Shared campaign access
            </h1>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-[#cbcbcb]">
              Grant a client access to a live owner campaign by email. The campaign appears in their dashboard under the client-facing name.
            </p>
          </div>
          <div className="grid gap-2 rounded-[18px] bg-[#121212] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] sm:grid-cols-2 lg:min-w-[320px]">
            <Metric label="Campaigns" value={String(campaigns.length)} />
            <Metric label="Client grants" value={String(accesses.length)} />
          </div>
        </div>
      </section>

      <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
        <div className="border-b border-[#27272a] pb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Create access</p>
          <h2 className="mt-2 text-[20px] font-bold text-[#ffffff]">Onboard a client</h2>
        </div>
        <div className="pt-5">
          <CampaignClientOnboardingForm
            campaigns={campaigns.map((campaign) => ({
              id: campaign.id,
              name: campaign.name,
              owner: campaign.user.email ?? campaign.user.name ?? "Unknown owner",
            }))}
          />
        </div>
      </section>

      <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px] lg:p-6">
        <div className="flex flex-col gap-2 border-b border-[#27272a] pb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">Existing access</p>
          <h2 className="text-[20px] font-bold text-[#ffffff]">Client campaign grants</h2>
        </div>

        <div className="grid gap-3 pt-5">
          {accesses.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[#3f3f46] p-5 text-[14px] leading-6 text-[#b3b3b3]">
              No client access grants have been created yet.
            </div>
          ) : (
            accesses.map((access) => (
              <article
                className="grid gap-4 rounded-[18px] bg-[#121212] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset] lg:grid-cols-[1fr_auto] lg:items-center"
                key={access.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill label={access.user ? "linked" : "pending"} tone={access.user ? "good" : "warn"} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f8f8f]">
                      Created {formatDate(access.createdAt)}
                    </span>
                  </div>
                  <h3 className="mt-3 text-[16px] font-bold text-[#ffffff]">{access.displayName}</h3>
                  <p className="mt-2 text-[13px] leading-5 text-[#cbcbcb]">
                    {access.email} gets access to {access.campaign.name}.
                  </p>
                  {access.user ? (
                    <p className="mt-1 text-[12px] text-[#8f8f8f]">
                      Linked user: {access.user.email ?? access.user.name ?? "Unknown user"}
                    </p>
                  ) : null}
                </div>
                <form action={revokeCampaignClientAccess}>
                  <input name="accessId" type="hidden" value={access.id} />
                  <Button
                    className="w-full rounded-full border-none bg-[#3a151b] px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ff9aa5] shadow-[rgb(243,114,127)_0px_0px_0px_1px_inset] hover:bg-[#4a1c24] lg:w-auto"
                    type="submit"
                    variant="secondary"
                  >
                    Revoke
                  </Button>
                </form>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-[#1f1f1f] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b3b3b3]">{label}</p>
      <p className="mt-2 text-[1.45rem] font-bold leading-none text-[#ffffff]">{value}</p>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "good" | "warn" }) {
  const className = tone === "good"
    ? "bg-[#12331f] text-[#73f5a0] shadow-[rgb(30,215,96)_0px_0px_0px_1px_inset]"
    : "bg-[#3b2d10] text-[#ffd66e] shadow-[rgb(242,201,76)_0px_0px_0px_1px_inset]";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${className}`}>
      {label}
    </span>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
