import type { CampaignLeadView } from "@/lib/campaign-leads";

type DemoLeadInput = {
  body: string;
  buyerStage: NonNullable<CampaignLeadView["ai"]>["buyerStage"];
  category: string;
  detectedMinutesAgo: number;
  id: string;
  intentType: NonNullable<CampaignLeadView["ai"]>["intentType"];
  label: CampaignLeadView["label"];
  painPoints: string[];
  postedMinutesAgo: number;
  score: number;
  semanticScore: number;
  status: CampaignLeadView["status"];
  subreddit: string;
  summary: string;
  title: string;
};

export function createCampaignLiveDemoLeads({
  dayFrom,
  dayTo,
  now = new Date(),
}: {
  dayFrom: Date;
  dayTo: Date;
  now?: Date;
}): CampaignLeadView[] {
  return [
    createLead({
      body: "We have two pallets ready in Shenzhen and need them shipped to Toronto. Looking for a freight forwarder who can handle pickup, customs paperwork, and final delivery. Any recommendations?",
      buyerStage: "evaluating",
      category: "Freight forwarding",
      detectedMinutesAgo: 3,
      id: "demo-live-china-canada",
      intentType: "explicit",
      label: "HIGH",
      painPoints: ["Needs a reliable forwarder", "Time-sensitive shipment", "Unclear customs process"],
      postedMinutesAgo: 18,
      score: 93,
      semanticScore: 0.95,
      status: "NEW",
      subreddit: "logistics",
      summary: "The author is actively looking for a freight-forwarding partner for a defined China-to-Canada shipment.",
      title: "Need a freight forwarder for China to Canada",
    }, { dayFrom, dayTo, now }),
    createLead({
      body: "Our first commercial shipment is arriving next week and I am not confident our paperwork is correct. Can anyone recommend a customs broker in Toronto who works with small importers?",
      buyerStage: "solution_aware",
      category: "Customs brokerage",
      detectedMinutesAgo: 8,
      id: "demo-live-customs-toronto",
      intentType: "explicit",
      label: "HIGH",
      painPoints: ["Shipment arriving soon", "Needs Canadian import guidance"],
      postedMinutesAgo: 31,
      score: 91,
      semanticScore: 0.92,
      status: "NEW",
      subreddit: "importexport",
      summary: "A business owner needs customs-clearance help and is explicitly searching for a Canadian broker.",
      title: "Looking for a customs broker in Toronto",
    }, { dayFrom, dayTo, now }),
    createLead({
      body: "I need to move a used CNC machine from Michigan to Toronto. It weighs about 4,000 lb. What type of carrier should I contact, and what documents will I need?",
      buyerStage: "problem_aware",
      category: "Heavy equipment shipping",
      detectedMinutesAgo: 15,
      id: "demo-live-machinery",
      intentType: "implicit",
      label: "MED",
      painPoints: ["Oversized machinery", "Cross-border transport", "Needs a cost estimate"],
      postedMinutesAgo: 52,
      score: 84,
      semanticScore: 0.87,
      status: "NEW",
      subreddit: "shipping",
      summary: "The post describes a concrete cross-border machinery move and asks for provider recommendations.",
      title: "Shipping machinery from the US to Toronto",
    }, { dayFrom, dayTo, now }),
    createLead({
      body: "We are planning our first 40-foot container from Busan to Vancouver. I would appreciate recommendations for forwarders and a rough idea of current transit times.",
      buyerStage: "evaluating",
      category: "Ocean freight",
      detectedMinutesAgo: 24,
      id: "demo-live-fcl-vancouver",
      intentType: "explicit",
      label: "HIGH",
      painPoints: ["Needs an FCL quote", "Comparing transit times", "First international shipment"],
      postedMinutesAgo: 76,
      score: 89,
      semanticScore: 0.91,
      status: "NEW",
      subreddit: "freightforwarding",
      summary: "The buyer is comparing providers for a specific full-container shipment into Vancouver.",
      title: "FCL shipment from Busan to Vancouver",
    }, { dayFrom, dayTo, now }),
  ];
}

function createLead(
  input: DemoLeadInput,
  range: { dayFrom: Date; dayTo: Date; now: Date },
): CampaignLeadView {
  const nowMs = range.now.getTime();
  const detectedAt = Math.min(
    range.dayTo.getTime() - 1,
    Math.max(range.dayFrom.getTime(), nowMs - input.detectedMinutesAgo * 60_000),
  );

  return {
    ai: {
      buyerStage: input.buyerStage,
      category: input.category,
      disqualifier: null,
      intentType: input.intentType,
      painPoints: input.painPoints,
      summary: input.summary,
    },
    createdAt: new Date(detectedAt).toISOString(),
    id: input.id,
    isDemo: true,
    label: input.label,
    redditItem: {
      body: input.body,
      createdUtc: new Date(nowMs - input.postedMinutesAgo * 60_000).toISOString(),
      description: input.body,
      subreddit: input.subreddit,
      title: input.title,
      type: "POST",
      url: `https://www.reddit.com/r/${input.subreddit}/`,
    },
    score: input.score,
    semanticScore: input.semanticScore,
    status: input.status,
  };
}
