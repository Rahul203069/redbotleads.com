import { PlaceholderPage } from "@/components/app/placeholder-page";

export default function LeadsPage() {
  return (
    <PlaceholderPage
      eyebrow="Lead review"
      title="Leads"
      description="Review matched Reddit opportunities, apply status changes, and prioritize high-intent threads before they go cold."
      cards={[
        {
          title: "Lead feed",
          description: "Filterable, score-ranked list of matched posts and comments with source and freshness context.",
        },
        {
          title: "Lead detail",
          description: "Full Reddit context, AI summary, pain points, and suggested replies for manual use.",
        },
        {
          title: "Workflow status",
          description: "Mark leads as new, saved, ignored, or replied once later engagement workflows exist.",
        },
      ]}
    />
  );
}
