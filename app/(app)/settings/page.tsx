import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function SettingsPage() {
  return (
    <PlaceholderPage
      eyebrow="Workspace controls"
      title="Settings"
      description="Manage notification channels, user preferences, and future workspace-level controls for discovery workflows."
      cards={[
        {
          title: "Notifications",
          description: "Email and Slack delivery preferences with per-user alert controls.",
        },
        {
          title: "Profile and plan",
          description: "User profile, account metadata, and later plan-related workspace settings.",
        },
        {
          title: "Operational defaults",
          description: "Future controls for scoring defaults, review behavior, and campaign-wide preferences.",
        },
      ]}
    />
  );
}
