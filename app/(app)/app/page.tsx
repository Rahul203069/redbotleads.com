import { AppHeader } from "@/components/app/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function AppHomePage() {
  const session = await auth();
  const displayName = session?.user.name ?? session?.user.email ?? "operator";

  return (
    <div className="space-y-6">
      <AppHeader
        eyebrow="Workspace ready"
        title={`Signed in as ${displayName}`}
        description="Your authentication flow is active. This app shell is now structured for campaigns, leads, settings, and later worker-backed intelligence views."
      />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Pipeline status</CardTitle>
            <CardDescription>Current product areas queued for implementation inside the authenticated app.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <SignalStat label="Campaign setup" value="Next" />
            <SignalStat label="Lead inbox" value="Pending" />
            <SignalStat label="Alerts" value="Pending" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">MVP direction</CardTitle>
            <CardDescription>Discovery-first workflow with worker-backed enrichment arriving after core CRUD.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-[#27272a] bg-[#111113] px-4 py-3 text-sm text-[#d4d4d8]">
              1. Campaign creation and targeting
            </div>
            <div className="rounded-2xl border border-[#27272a] bg-[#111113] px-4 py-3 text-sm text-[#d4d4d8]">
              2. Leads list and detail views
            </div>
            <div className="rounded-2xl border border-[#27272a] bg-[#111113] px-4 py-3 text-sm text-[#d4d4d8]">
              3. Worker-backed ingestion and scoring
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SignalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#27272a] bg-[#111113] p-4">
      <div className="text-xs uppercase tracking-[0.24em] text-[#71717a]">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#fafafa]">{value}</div>
    </div>
  );
}
