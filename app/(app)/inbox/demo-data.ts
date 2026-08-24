import type { CampaignLeadStatus } from "@/lib/campaign-lead-status";
import type { LiveLeadFilter, LiveLeadStatusCounts, LiveLeadView } from "@/lib/live-leads";

export const DEMO_INBOX_CAMPAIGN = {
  id: "demo-inbox-campaign",
  name: "Demo · Ocean-Air Freight",
};

export function createDemoInboxLeads(now = Date.now()): LiveLeadView[] {
  return [
    createLead(now, {
      buyerStage: "decision",
      category: "Freight forwarding",
      detectedMinutesAgo: 4,
      id: "demo-lead-china-canada",
      intentType: "service_request",
      label: "HIGH",
      painPoints: ["Needs a reliable forwarder", "Time-sensitive international shipment", "Unclear customs process"],
      postedMinutesAgo: 18,
      score: 93,
      semanticScore: 0.95,
      status: "NEW",
      subreddit: "logistics",
      summary: "The author is actively asking for a freight-forwarding partner for a defined China-to-Canada shipment.",
      title: "Need a freight forwarder for China → Canada",
      body: "We have two pallets ready in Shenzhen and need them shipped to Toronto. Looking for a freight forwarder who can handle pickup, customs paperwork, and final delivery. Any recommendations?",
    }),
    createLead(now, {
      buyerStage: "decision",
      category: "Customs brokerage",
      detectedMinutesAgo: 12,
      id: "demo-lead-customs-toronto",
      intentType: "provider_search",
      label: "HIGH",
      painPoints: ["Shipment held at customs", "Needs Canadian import guidance"],
      postedMinutesAgo: 31,
      score: 91,
      semanticScore: 0.92,
      status: "NEW",
      subreddit: "importexport",
      summary: "A business owner needs immediate customs-clearance help and is explicitly looking for a Canadian broker.",
      title: "Looking for a customs broker in Toronto",
      body: "Our first commercial shipment is arriving next week and I am not confident our paperwork is correct. Can anyone recommend a customs broker in Toronto who works with small importers?",
    }),
    createLead(now, {
      buyerStage: "consideration",
      category: "Heavy equipment shipping",
      detectedMinutesAgo: 27,
      id: "demo-lead-machinery",
      intentType: "recommendation_request",
      label: "MED",
      painPoints: ["Oversized machinery", "Cross-border transport", "Needs cost estimate"],
      postedMinutesAgo: 58,
      score: 84,
      semanticScore: 0.87,
      status: "NEW",
      subreddit: "shipping",
      summary: "The post describes a concrete cross-border machinery move and asks for provider and pricing recommendations.",
      title: "Shipping machinery from the US to Toronto",
      body: "I need to move a used CNC machine from Michigan to Toronto. It weighs about 4,000 lb. What type of carrier or freight company should I contact, and what documents will I need?",
    }),
    createLead(now, {
      buyerStage: "consideration",
      category: "Ocean freight",
      detectedMinutesAgo: 43,
      id: "demo-lead-fcl-vancouver",
      intentType: "quote_request",
      label: "HIGH",
      painPoints: ["Needs an FCL quote", "Comparing transit times", "First international shipment"],
      postedMinutesAgo: 76,
      score: 89,
      semanticScore: 0.91,
      status: "NEW",
      subreddit: "freightforwarding",
      summary: "The buyer is comparing quotes for a specific full-container shipment into Vancouver.",
      title: "FCL shipment from Busan to Vancouver",
      body: "We are planning our first 40-foot container from Busan to Vancouver in September. I would appreciate recommendations for forwarders and a rough idea of current transit times.",
    }),
    createLead(now, {
      buyerStage: "consideration",
      category: "Pallet shipping",
      detectedMinutesAgo: 96,
      id: "demo-lead-korea-pallet",
      intentType: "provider_search",
      label: "HIGH",
      notes: "Strong fit. Follow up with the Vancouver consolidation option.",
      painPoints: ["Single-pallet shipment", "Needs consolidation", "Price sensitive"],
      postedMinutesAgo: 142,
      score: 87,
      semanticScore: 0.89,
      status: "SAVED",
      subreddit: "smallbusiness",
      summary: "A small business is looking for an affordable provider to consolidate and ship one pallet from Korea.",
      title: "Best way to ship one pallet from Korea to Vancouver?",
      body: "Air freight quotes are too high for us. Is there a company that can consolidate a single pallet from Incheon and deliver it to Vancouver?",
    }),
    createLead(now, {
      buyerStage: "decision",
      category: "Customs clearance",
      detectedMinutesAgo: 188,
      id: "demo-lead-clearance",
      intentType: "urgent_help",
      label: "HIGH",
      notes: "Replied with a request for the HS code and arrival notice.",
      painPoints: ["Cargo already arrived", "Missing clearance support", "Storage fees increasing"],
      postedMinutesAgo: 225,
      score: 90,
      semanticScore: 0.93,
      status: "CONTACTED",
      subreddit: "canadabusiness",
      summary: "The shipment is already at the terminal, making this an urgent and highly actionable customs-clearance opportunity.",
      title: "Urgent customs clearance help needed in Canada",
      body: "Our shipment arrived sooner than expected and our previous broker is unavailable. We need help clearing it before storage charges increase tomorrow.",
    }),
    createLead(now, {
      buyerStage: "awareness",
      category: "E-commerce fulfillment",
      detectedMinutesAgo: 310,
      id: "demo-lead-ecommerce",
      intentType: "advice_request",
      label: "MED",
      painPoints: ["Growing order volume", "International fulfillment complexity"],
      postedMinutesAgo: 370,
      score: 76,
      semanticScore: 0.81,
      status: "REVIEWED",
      subreddit: "ecommerce",
      summary: "The merchant is researching international fulfillment but has not yet committed to hiring a provider.",
      title: "When should we move from parcel shipping to freight?",
      body: "Our Canadian store is growing and we now receive inventory in batches of 40 to 60 cartons. At what point does pallet or freight shipping make more sense?",
    }),
    createLead(now, {
      buyerStage: "awareness",
      category: "Personal shipping",
      detectedMinutesAgo: 460,
      id: "demo-lead-personal-boxes",
      intentType: "general_question",
      label: "LOW",
      painPoints: ["Moving personal belongings"],
      postedMinutesAgo: 520,
      score: 61,
      semanticScore: 0.64,
      status: "DISMISSED",
      subreddit: "moving",
      summary: "This is a low-value personal move rather than a commercial freight opportunity.",
      title: "Cheapest way to move five boxes across Canada",
      body: "I am moving apartments and have five boxes of clothes and books. Is regular parcel delivery the easiest option?",
    }),
  ];
}

export function filterDemoInboxLeads(leads: LiveLeadView[], filter: LiveLeadFilter) {
  if (filter === "ALL") return leads;
  const status: CampaignLeadStatus = filter === "UNREVIEWED" ? "NEW" : filter;
  return leads.filter((lead) => lead.status === status);
}

export function countDemoInboxLeads(leads: LiveLeadView[]): LiveLeadStatusCounts {
  const counts: LiveLeadStatusCounts = {
    ALL: leads.length,
    UNREVIEWED: 0,
    NEW: 0,
    REVIEWED: 0,
    SAVED: 0,
    CONTACTED: 0,
    DISMISSED: 0,
  };

  for (const lead of leads) counts[lead.status] += 1;
  counts.UNREVIEWED = counts.NEW;
  return counts;
}

type DemoLeadInput = {
  body: string;
  buyerStage: string;
  category: string;
  detectedMinutesAgo: number;
  id: string;
  intentType: string;
  label: LiveLeadView["label"];
  notes?: string;
  painPoints: string[];
  postedMinutesAgo: number;
  score: number;
  semanticScore: number;
  status: CampaignLeadStatus;
  subreddit: string;
  summary: string;
  title: string;
};

function createLead(now: number, input: DemoLeadInput): LiveLeadView {
  return {
    ai: {
      buyerStage: input.buyerStage,
      category: input.category,
      intentType: input.intentType,
      painPoints: input.painPoints,
      summary: input.summary,
    },
    campaign: DEMO_INBOX_CAMPAIGN,
    createdAt: minutesAgo(now, input.detectedMinutesAgo),
    id: input.id,
    isDemo: true,
    label: input.label,
    notes: input.notes ?? null,
    redditItem: {
      body: input.body,
      createdUtc: minutesAgo(now, input.postedMinutesAgo),
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

function minutesAgo(now: number, minutes: number) {
  return new Date(now - minutes * 60_000).toISOString();
}
