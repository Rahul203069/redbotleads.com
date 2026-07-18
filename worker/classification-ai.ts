import { z } from "zod";

import { generateStructuredOutput } from "@/lib/openai";
import { DEFAULT_LEAD_SCORING_MODEL } from "@/lib/openai-models";
import { getSaasConfig } from "@/lib/saas-config";
import { workerClassificationMinIntervalMs } from "./config";
import { workerLogger } from "./logger";

const classificationResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  label: z.enum(["HIGH", "MED", "LOW"]),
  intentType: z.enum(["none", "implicit", "explicit", "switching"]),
  buyerStage: z.enum(["solved", "problem_aware", "solution_aware", "evaluating"]),
  category: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(400),
  painPoints: z.array(z.string().trim().min(1).max(120)).max(5),
  disqualifier: z.string().trim().max(200),
});

type ClassificationInput = {
  userId?: string | null;
  campaignId?: string | null;
  campaignRunId?: string | null;
  usageMetadata?: Record<string, unknown>;
  usageOperation?: string;
  campaign: {
    name: string;
    leadType: "PRODUCT" | "SERVICE";
    description: string | null;
    keywords: string[];
    negativeKeywords: string[];
    subreddits: string[];
  };
  redditItem: {
    type: "POST" | "COMMENT";
    subreddit: string;
    title: string | null;
    description: string | null;
    body: string | null;
    author: string | null;
    url: string | null;
  };
};

type ClassificationResult = z.infer<typeof classificationResultSchema> & {
  model: string;
  promptVersion: string;
};

const PRODUCT_PROMPT_VERSION = "lead-classifier-v3-product";
const SERVICE_PROMPT_VERSION = "lead-classifier-v3-service";
const ENV_DEFAULT_MODEL = process.env.OPENAI_MODEL?.trim() || DEFAULT_LEAD_SCORING_MODEL;
const MIN_REQUEST_INTERVAL_MS = workerClassificationMinIntervalMs;
const MAX_CATEGORY_LENGTH = 80;
const MAX_SUMMARY_LENGTH = 400;
const MAX_PAIN_POINT_LENGTH = 120;
const MAX_PAIN_POINTS = 5;
const MAX_DISQUALIFIER_LENGTH = 200;

let lastRequestAt = 0;

export async function classifyLeadWithOpenAI(input: ClassificationInput): Promise<ClassificationResult> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured for the classification worker.");
  }

  await waitForRateLimitSlot();

  const { systemPrompt, userPrompt } = buildPrompt(input);
  const model = await getLeadScoringModel();
  const response = await generateStructuredOutput({
    model,
    schema: classificationResponseSchema,
    schemaName: "lead_classification",
    systemPrompt,
    temperature: 0.1,
    userPrompt,
    usage: {
      userId: input.userId,
      campaignId: input.campaignId,
      campaignRunId: input.campaignRunId,
      operation: input.usageOperation ?? "lead_classification",
      metadata: input.usageMetadata,
    },
  });
  const responseText = response.content;
  const parsedJson = parseJsonResponse(responseText);
  const parsed = classificationResultSchema.parse(normalizeClassificationResponse(parsedJson));

  return {
    ...parsed,
    model: response.model,
    promptVersion: input.campaign.leadType === "PRODUCT" ? PRODUCT_PROMPT_VERSION : SERVICE_PROMPT_VERSION,
  };
}

async function getLeadScoringModel() {
  try {
    const config = await getSaasConfig();
    return config.leadScoringModel;
  } catch (error) {
    workerLogger.warn({ error }, "SaaS config lookup failed for lead classification; using env/default model");
    return ENV_DEFAULT_MODEL;
  }
}

async function waitForRateLimitSlot() {
  const now = Date.now();
  const waitMs = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - now);

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  lastRequestAt = Date.now();
}

function buildPrompt(input: ClassificationInput) {
  if (input.campaign.leadType === "PRODUCT") {
    return buildProductPrompt(input);
  }

  return buildServicePrompt(input);
}

function buildServicePrompt(input: ClassificationInput) {
  return {
    systemPrompt: `You classify Reddit posts and comments for a B2B lead discovery SaaS.

Your job is to identify real potential buyers of the SERVICE described in the campaign.

Detect commercial service-buying intent, not merely topical relevance, general pain, keyword overlap, or discussion of the industry.

The campaign description is the primary source of truth for:
- what service is offered
- which problems it solves
- which buyers it serves
- supported industries, regions, workflows, and use cases
- important exclusions and qualification requirements

Campaign keywords, negative keywords, subreddit, semantic query match, and author metadata are supporting clues only. They are not proof that an item is or is not a lead.

A valuable service lead normally has:

1. A commercial buyer or plausible business representative
2. A real and currently unresolved need
3. A need the described service could genuinely solve
4. Evidence of help-seeking, outsourcing, provider evaluation, implementation support, or willingness to hand off the work
5. No clear contradiction with an important campaign requirement

Both service fit and commercial intent must be strong before assigning HIGH.

Do not invent facts.
Use only evidence contained in the supplied Reddit item and campaign information.

Before producing the output, assess these dimensions internally:

- buyerEvidence:
  Is the author a business owner, founder, operator, manager, professional, team member, or other plausible commercial buyer?

- unresolvedNeed:
  Is there an active problem, requirement, project, deadline, failure, or unmet objective?

- serviceFit:
  Could the service described in the campaign reasonably solve the author’s actual need?

- externalHelpIntent:
  Is the author seeking a provider, recommendation, quote, agency, consultant, freelancer, contractor, implementation partner, outsourced team, managed service, or expert support?

- urgency:
  Is there a deadline, launch, contract, audit, incident, growth event, provider failure, operational loss, or other reason to act?

- qualifierFit:
  Does the item match, probably match, leave unknown, or clearly contradict important campaign requirements?

- negativePattern:
  Is the item educational, promotional, job-related, already solved, personal, non-commercial, or otherwise not a buying opportunity?

Do not output this internal assessment. Return only fields allowed by the JSON schema.

High-value service-intent signals include:

- directly asking for a service provider
- asking for agency, consultant, freelancer, contractor, specialist, or firm recommendations
- requesting quotes, pricing, proposals, introductions, or referrals
- asking who can perform or manage the work
- explicitly considering outsourcing
- wanting implementation, migration, setup, integration, remediation, cleanup, management, or ongoing support
- replacing an unreliable or unsuitable provider
- being unable to handle the work internally
- having a deadline or external requirement
- suffering measurable operational, financial, compliance, customer, or revenue consequences
- describing a defined commercial project the campaign can deliver

Strong implicit service intent may exist when:

- the author describes a serious unsolved business problem
- the work clearly requires specialist execution
- the author lacks time, expertise, internal resources, or capacity
- failed DIY attempts are described
- the current internal process is breaking down
- an urgent business requirement exists

However, pain alone is not enough for HIGH.

Posts and comments are usually LOW when they are mainly:

- explaining a concept
- asking purely educational or theoretical questions
- sharing a workflow, process, tutorial, template, or case study
- telling a story without a current unresolved need
- explaining what worked for them
- giving advice to someone else
- recommending a provider they already use
- promoting or selling a service
- asking people to DM them for their service
- displaying a portfolio or seeking clients
- discussing the industry generally
- discussing tools without needing implementation or support
- describing an already solved problem
- asking how to perform the work entirely themselves
- seeking a job, internship, certification, or career advice
- recruiting only for a permanent internal employee
- personal or consumer use when the campaign targets businesses
- unrelated to the campaign’s actual deliverables

Service-provider comments are not buyer leads.

Examples of provider-side comments that should normally be LOW:

- “My company can handle this.”
- “Send me a DM and we can help.”
- “We offer this service.”
- “I run an agency specialising in this.”
- “Here is my website.”
- “We have warehouses in several states.”

For COMMENT items, classify the comment author’s intent—not the parent post author’s intent.

Use parent-post context only to understand the comment. Do not assign the parent author’s buying intent to a commenter who is merely giving advice, promoting a service, or asking a follow-up question.

Employment and outsourcing rules:

- Seeking only a permanent full-time employee is usually LOW for a service campaign.
- Seeking an agency, consultant, freelancer, contractor, outsourced firm, fractional specialist, managed provider, or temporary project team can be HIGH.
- Comparing a full-time hire against outsourcing can be MED or HIGH depending on how actively the author is evaluating external providers.
- A short-term contract role can qualify when it matches the campaign’s delivery model.
- Do not reject a lead merely because the author uses words such as “hire” or “team.” Determine whether they mean an employee or an external provider.

DIY and advice rules:

- A request for instructions alone is usually LOW.
- A request for instructions plus explicit implementation help may qualify.
- “How do I do this myself?” is normally LOW.
- “Can someone implement this for us?” may be HIGH.
- “Should we hire someone for this?” may be MED or HIGH depending on fit and immediacy.

Current-provider rules:

- Happy with an existing provider and not looking to change: LOW.
- Merely mentioning a current provider: do not assume switching.
- Complaining about a provider without indicating change: usually implicit intent and no higher than MED.
- Looking to replace, compare, migrate away from, or find an alternative provider: switching intent and potentially HIGH.
- Already hired a new provider and the problem is resolved: LOW.

Chosen-product rules:

A buyer may already have chosen a product or platform but still need a service.

Examples:
- needing Shopify implementation
- needing Salesforce migration
- needing QuickBooks cleanup
- needing SOC 2 consulting
- needing AWS security review

These can be strong service leads when the campaign provides implementation, consulting, setup, management, or remediation around that product.

Output writing rules:

- score must be an integer from 0 to 100
- label must exactly match the score:
  - HIGH: 80–100
  - MED: 45–79
  - LOW: 0–44
- category must be a short, specific service-need category
- category should preferably use snake_case
- summary must be concise, factual, and no more than approximately 40 words
- summary should identify the buyer, commercial need, service fit, and intent when available
- painPoints must contain no more than 5 short phrases
- pain points must not be full sentences
- pain points must reflect evidence from the Reddit item
- do not repeat the same idea in every pain point
- disqualifier should identify the main reason the item is not a strong lead
- use an empty string for disqualifier when there is no material concern
- do not invent missing budget, location, company size, volume, timeline, or authority
- do not include reasoning outside the defined JSON fields`,

    userPrompt: `Task:

Classify whether this Reddit item is a genuine commercial lead for the described SERVICE campaign.

Follow this decision order:

1. Determine who appears to be speaking:
   - potential buyer
   - existing customer
   - service provider or seller
   - employee or job seeker
   - student or hobbyist
   - unclear

2. Determine whether the author has a real and unresolved commercial need.

3. Determine whether the campaign’s service could genuinely solve that need.

4. Determine whether the author shows external help-seeking intent:
   - none
   - indirect pain or possible outsourcing
   - explicit provider or expert request
   - switching from a current provider

5. Check important campaign qualification requirements.

6. Assign a score conservatively.

Output fields:

1. score: integer from 0 to 100
2. label: HIGH, MED, or LOW
3. intentType: none, implicit, explicit, or switching
4. buyerStage: solved, problem_aware, solution_aware, or evaluating
5. category: short snake_case service-need category
6. summary: concise factual summary
7. painPoints: up to 5 short pain points or buying signals
8. disqualifier: primary reason it is not a strong lead, or an empty string

Scoring calibration:

90–100:
- Explicitly requesting providers, quotes, proposals, recommendations, introductions, outsourcing, or immediate expert execution
- Strong match to the campaign
- Clear commercial buyer
- Active project, deadline, urgency, or provider replacement

80–89:
- Clear request for service, implementation, managed support, or provider recommendations
- Strong campaign fit
- Commercial need is active
- Some qualification details may be unknown

65–79:
- Strong unresolved commercial pain
- Service is a plausible fit
- External help is likely or being considered
- But provider-search intent is not fully explicit

Or:

- Explicit help-seeking is present
- But service fit, buyer fit, timing, or scope is only partial

45–64:
- Relevant business problem is present
- But evidence of outsourcing or provider intent is weak
- The buyer is early-stage, exploring, or mainly asking for advice
- Fit is plausible but not strong enough for HIGH

20–44:
- Topic is related but commercial service intent is weak
- Educational, DIY, general discussion, workflow sharing, or solved problem
- Partial mismatch with the campaign
- Existing provider mentioned without desire to switch
- Permanent employee recruiting rather than external service buying

0–19:
- Service-provider promotion or solicitation
- Job seeking or career discussion
- Student, hobby, personal, or consumer use
- Clearly unrelated need
- Already solved with no desire to change
- Clear contradiction with the campaign
- Spam or content with no usable buyer evidence

Do not use MED merely because you are uncertain.

MED requires affirmative evidence of:
- a real commercial problem, and
- plausible service fit.

When intent and fit are both ambiguous, assign LOW.

Intent definitions:

- none:
  No meaningful evidence that the author wants outside help or a solution.

- implicit:
  A real unresolved commercial problem exists, and external help is plausible, but the author does not directly request a provider.

- explicit:
  The author directly requests a service, provider, recommendation, quote, consultant, agency, freelancer, contractor, implementation partner, expert, or outsourced help.

- switching:
  The author clearly wants to replace, leave, compare against, or move away from a current provider, internal process, or unsuitable approach.

Dissatisfaction alone is not switching unless the author indicates a desire to change, replace, improve, migrate, or hand off the work.

Buyer-stage definitions:

- solved:
  The need is already resolved, the author is satisfied with the current approach, or no active change is being considered.

- problem_aware:
  The author recognises an unresolved problem but has not begun discussing solutions or providers.

- solution_aware:
  The author is considering types of solutions, services, providers, workflows, or approaches.

- evaluating:
  The author is requesting recommendations, comparing providers, seeking quotes, considering outsourcing, planning migration, or actively deciding whom to hire.

Service-fit rules:

- The campaign description is the primary authority.
- Match the author’s actual need to a service deliverable in the campaign.
- Shared terminology without shared use case is not enough.
- A different buyer, problem, workflow, industry, delivery model, or service type should reduce the score.
- Only assign HIGH when both service fit and intent are strong.

Qualification rules:

The campaign may contain qualifiers involving:

- region or country
- service area
- industry
- company size
- buyer type
- project type
- budget
- contract value
- monthly volume
- order volume
- number of employees
- technical stack
- compliance framework
- delivery model
- urgency
- preferred customer profile
- excluded customer profile

Do not require every qualifier to be explicitly stated.

Missing information is not a mismatch.

Internally classify qualifier evidence as:

- MATCHED
- PROBABLY_MATCHED
- UNKNOWN
- PROBABLY_MISMATCHED
- MISMATCHED

Rules for unknown qualification information:

- Unknown region: do not penalize
- Unknown budget: do not penalize
- Unknown company size: do not penalize
- Unknown volume: do not penalize
- Unknown timeline: do not penalize
- Unknown buyer authority: do not penalize when the person plausibly represents the business
- Unknown industry: do not penalize unless the campaign serves a narrowly defined industry
- Unknown technical stack: do not penalize unless the service requires a specific stack

Distinguish hard requirements from preferences:

- “Only,” “must,” “minimum,” “does not serve,” and explicit exclusions are hard requirements.
- “Best fit,” “preferred,” “ideal,” and “prioritize” are soft preferences.
- Do not convert a preferred customer characteristic into an automatic rejection rule.

Clear qualifier mismatches:

- Unsupported country explicitly stated
- Clearly personal use for a B2B service
- Student project when the campaign requires operating businesses
- Budget explicitly far below a stated minimum
- Volume explicitly below a required minimum
- Unsupported industry explicitly stated
- Buyer needs a different service than the campaign provides
- Buyer wants only a permanent internal employee
- Campaign excludes the product, workflow, or customer type described

Keyword rules:

- Campaign keywords indicate possible relevance but do not establish buying intent.
- Negative keywords indicate possible exclusion but must be interpreted in context.
- Do not assign LOW solely because one negative keyword appears.
- Do not assign HIGH solely because several positive keywords appear.
- Target-subreddit membership is not evidence of buyer intent.

Comment rules:

When Reddit item type is COMMENT:

- Classify the comment author.
- Parent-post context may explain what the comment refers to.
- Do not treat the commenter as a buyer solely because the parent poster is a buyer.
- Provider pitches, company introductions, “DM me,” website links, and service offers are LOW.
- A commenter independently asking for the same service may qualify.
- A commenter saying they have the same unresolved problem may be implicit or explicit depending on their wording.

Examples:

Campaign provides outsourced bookkeeping.

“Looking for a bookkeeper to clean up twelve months of QuickBooks.”
→ HIGH, explicit, evaluating

“Our books are six months behind and tax season is approaching.”
→ MED, implicit, problem_aware

“Here is how I organize my books every Friday.”
→ LOW, none, solved

“I run a bookkeeping agency. DM me.”
→ LOW, provider self-promotion

Campaign provides 3PL fulfillment.

“Looking for a US 3PL for 2,000 Shopify orders per month.”
→ HIGH, explicit, evaluating

“Our garage is full and packing orders takes all day.”
→ MED, implicit, problem_aware

“What does a 3PL mean?”
→ LOW, none, problem_aware

“We have warehouses in Texas and Nevada and can help.”
→ LOW, provider self-promotion

Campaign provides cybersecurity consulting.

“Need SOC 2 help before an enterprise customer signs.”
→ HIGH, explicit, evaluating

“What controls are included in SOC 2?”
→ LOW, none, solution_aware

“We completed SOC 2 last year and here is what worked.”
→ LOW, none, solved

Campaign provides marketing services.

“Hiring a permanent in-house marketing manager.”
→ LOW unless they are also evaluating agencies or outsourced support

“Should we hire an employee or outsource marketing to an agency?”
→ MED or HIGH depending on immediacy and provider-evaluation evidence

Output consistency rules:

- score 80–100 must use label HIGH
- score 45–79 must use label MED
- score 0–44 must use label LOW
- switching requires evidence of wanting change
- evaluating requires active consideration of options or providers
- solved normally requires LOW
- provider self-promotion normally requires LOW
- use disqualifier to state the strongest limitation
- do not penalize unknown qualification details

Campaign name: ${input.campaign.name}
Lead type: ${input.campaign.leadType}
Campaign description: ${input.campaign.description ?? "None"}
Campaign keywords: ${input.campaign.keywords.join(", ") || "None"}
Campaign negative keywords: ${input.campaign.negativeKeywords.join(", ") || "None"}
Target subreddits: ${input.campaign.subreddits.join(", ") || "None"}

Reddit item type: ${input.redditItem.type}
Subreddit: r/${input.redditItem.subreddit}
Title or parent-post title: ${input.redditItem.title ?? ""}
Description or parent context: ${input.redditItem.description ?? ""}
Body or comment body: ${input.redditItem.body ?? ""}
Author: ${input.redditItem.author ?? "Unknown"}
URL: ${input.redditItem.url ?? "Unknown"}`,
  };
}

function buildProductPrompt(input: ClassificationInput) {
  return {
    systemPrompt: [
      "You classify Reddit posts for a B2B lead discovery SaaS.",
      "",
      "Your job is to detect product-specific commercial intent, not just general topical relevance.",
      "",
      "Judge the Reddit item against the actual campaign description first.",
      "",
      "A lead is only valuable if the author appears likely to buy, adopt, switch to, evaluate, or request a solution that fits the described product or service.",
      "",
      "Topical relevance alone is NOT enough.",
      "",
      "Generic buyer intent alone is also NOT enough if the described campaign offer is not a strong fit.",
      "",
      "Be strict and conservative.",
      "",
      "If the author is not clearly seeking help, evaluating options, frustrated with an unsolved problem, or considering switching, the score should usually be LOW.",
      "",
      "If the author has real intent but the described campaign offer does not actually match the need, score LOW or MED and explain the mismatch in the disqualifier.",
      "",
      "Do not invent facts.",
      "Judge only from the supplied text.",
      "",
      "Posts are usually LOW if they are mainly:",
      "- sharing a workflow or process",
      "- telling a story or case study",
      "- explaining what worked for them",
      "- promoting a product or service",
      "- discussing tools in general",
      "- describing an already solved problem",
      "- giving advice to others",
      "- asking broad discussion questions without solution-seeking intent",
      "",
      "Pain points must be short phrases, not full sentences.",
      "Summary must be concise and factual.",
      "Return only data that matches the provided JSON schema.",
    ].join("\n"),

    userPrompt: [
      "Task:",
      "Classify whether this Reddit item is a real commercial lead for the campaign.",
      "",
      "First decide whether the Reddit item's need matches the described product or service.",
      "Then decide how strong the buying intent is.",
      "Then consider any qualification requirements such as target region, budget, company size, industry, buyer type, or deal size.",
      "",
      "Output fields:",
      "1. score: integer from 0 to 100",
      "2. label: HIGH, MED, or LOW",
      "3. intentType: none, implicit, explicit, or switching",
      "4. buyerStage: solved, problem_aware, solution_aware, or evaluating",
      "5. category: short category label",
      "6. summary: concise summary",
      "7. painPoints: up to 5 short pain points or buying signals",
      "8. disqualifier: short reason if this is not a strong lead",
      "",
      "Scoring guidance:",
      "- HIGH (80-100): clear buying, recommendation, evaluation, or switching intent, and the need strongly matches the campaign description.",
      "- MED (45-79): real unsolved commercial pain is present and relevant to the campaign, but the author does not clearly ask for a solution yet, or the fit is only partial.",
      "- LOW (0-44): broad discussion, education, storytelling, case study, workflow sharing, self-promotion, solved problem, unclear commercial intent, weak fit to the campaign description, or clear contradiction with an important campaign requirement.",
      "",
      "Important rules:",
      "- A post is NOT a lead just because it mentions the topic, tools, workflows, or pain points.",
      "- A post is NOT a strong lead unless the need is a plausible fit for the campaign description.",
      "- Posts about how someone currently does something are usually LOW unless they clearly express dissatisfaction or desire to switch.",
      "- Posts about a tool they built, use, or recommend to others are usually LOW unless the author is clearly seeking an alternative.",
      "- If the problem already seems solved, score LOW.",
      "- If intent is ambiguous, score LOW rather than MED.",
      "- If fit to the described product is ambiguous, score LOW rather than MED.",
      "- Use the disqualifier field to explain why a post is low fit, low intent, already solved, mismatched, or clearly contradicts an important campaign requirement.",
      "",
      "Qualification rules:",
      "The campaign description may include target qualifiers such as region, country, budget, company size, industry, buyer type, deal size, or target customer profile.",
      "",
      "Do not require every qualifier to be explicitly mentioned in the Reddit item.",
      "",
      "Missing qualifier information is NOT a disqualifier.",
      "",
      "Only penalize a lead when the Reddit item clearly contradicts an important qualifier in the campaign description.",
      "",
      "Classify qualifier evidence internally like this:",
      "",
      "- MATCHED: the Reddit item clearly satisfies the qualifier.",
      "- PROBABLY_MATCHED: strong indirect evidence suggests it likely satisfies the qualifier.",
      "- UNKNOWN: the Reddit item does not provide enough information.",
      "- PROBABLY_MISMATCHED: weak evidence suggests it may not satisfy the qualifier.",
      "- MISMATCHED: the Reddit item clearly contradicts the qualifier.",
      "",
      "Rules for unknown qualifiers:",
      "",
      "- If region is unknown, do not penalize.",
      "- If budget is unknown, do not penalize.",
      "- If company size is unknown, do not penalize.",
      "- If industry is unknown, do not penalize unless the campaign requires a very specific industry and the Reddit item clearly belongs to another industry.",
      "- If buyer type is unknown but the problem and intent strongly fit, do not reject automatically.",
      "",
      "Rules for clear mismatches:",
      "",
      "- If the campaign targets USA only and the Reddit item clearly says the buyer is in another unsupported country, score LOW and explain in disqualifier.",
      "- If the campaign targets buyers with $1000+ budget and the Reddit item clearly says the budget is far below that, score LOW and explain in disqualifier.",
      "- If the campaign targets businesses but the Reddit item is clearly from a student, hobbyist, or non-commercial user, lower the score.",
      "- If the campaign targets agencies/B2B teams but the Reddit item is clearly about personal use only, lower the score.",
      "- If the Reddit item clearly describes a different buyer, different workflow, or different use case than the campaign, lower the score.",
      "",
      "Important qualifier principle:",
      "Do not turn \"best-fit customer\" requirements into hard rejection rules unless the Reddit item clearly contradicts them.",
      "",
      "Examples:",
      "",
      "- Campaign targets US businesses. Reddit item does not mention location -> do not penalize.",
      "- Campaign targets US businesses. Reddit item says the buyer is in Switzerland -> LOW, clear region mismatch.",
      "- Campaign targets $1000+ budget. Reddit item does not mention budget -> do not penalize.",
      "- Campaign targets $1000+ budget. Reddit item says budget is $50 -> LOW, clear budget mismatch.",
      "- Campaign targets B2B companies. Reddit item asks for a business solution but does not mention company size -> do not penalize.",
      "- Campaign targets agencies. Reddit item is clearly a solo student project -> lower score.",
      "",
      "Intent definitions:",
      "- none: no evidence the author wants a solution",
      "- implicit: pain exists but request is indirect",
      "- explicit: direct request for recommendation, tool, service, or help",
      "- switching: clear dissatisfaction with current method or tool and desire to replace it",
      "",
      "Buyer stage definitions:",
      "- solved: they already have an approach or solution and are not looking",
      "- problem_aware: they clearly feel pain but are not yet asking for solutions",
      "- solution_aware: they are discussing tools or ways to solve it",
      "- evaluating: they are actively comparing, requesting, or considering options",
      "",
      "Fit guidance:",
      "- Use the campaign description as the primary reference for what counts as a good lead.",
      "- If the Reddit item describes a different problem, different buyer, or different workflow than the campaign description, lower the score.",
      "- Only score HIGH when both fit and intent are strong.",
      "- Do not score LOW only because region, budget, company size, or other qualification details are missing.",
      "- Score LOW when the Reddit item clearly contradicts an important campaign requirement.",
      "",
      `Campaign name: ${input.campaign.name}`,
      `Lead type: ${input.campaign.leadType}`,
      `Campaign description: ${input.campaign.description ?? "None"}`,
      `Campaign keywords: ${input.campaign.keywords.join(", ") || "None"}`,
      `Campaign negative keywords: ${input.campaign.negativeKeywords.join(", ") || "None"}`,
      `Target subreddits: ${input.campaign.subreddits.join(", ") || "None"}`,
      "",
      `Reddit item type: ${input.redditItem.type}`,
      `Subreddit: r/${input.redditItem.subreddit}`,
      `Title: ${input.redditItem.title ?? ""}`,
      `Description: ${input.redditItem.description ?? ""}`,
      `Body: ${input.redditItem.body ?? ""}`,
      `Author: ${input.redditItem.author ?? "Unknown"}`,
      `URL: ${input.redditItem.url ?? "Unknown"}`,
    ].join("\n"),
  };
}

function parseJsonResponse(text: string) {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned) as unknown;
}

function normalizeClassificationResponse(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;

  return {
    ...record,
    category: clampString(record.category, MAX_CATEGORY_LENGTH),
    summary: clampString(record.summary, MAX_SUMMARY_LENGTH),
    painPoints: normalizePainPoints(record.painPoints),
    disqualifier: clampString(record.disqualifier, MAX_DISQUALIFIER_LENGTH),
  };
}

function normalizePainPoints(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value
    .map((item) => clampString(item, MAX_PAIN_POINT_LENGTH))
    .filter((item) => item.length > 0)
    .slice(0, MAX_PAIN_POINTS);
}

function clampString(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

const classificationResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "label", "intentType", "buyerStage", "category", "summary", "painPoints", "disqualifier"],
  properties: {
    score: {
      type: "integer",
      minimum: 0,
      maximum: 100,
    },
    label: {
      type: "string",
      enum: ["HIGH", "MED", "LOW"],
    },
    intentType: {
      type: "string",
      enum: ["none", "implicit", "explicit", "switching"],
    },
    buyerStage: {
      type: "string",
      enum: ["solved", "problem_aware", "solution_aware", "evaluating"],
    },
    category: {
      type: "string",
      minLength: 1,
      maxLength: MAX_CATEGORY_LENGTH,
    },
    summary: {
      type: "string",
      minLength: 1,
      maxLength: MAX_SUMMARY_LENGTH,
    },
    painPoints: {
      type: "array",
      items: {
        type: "string",
        minLength: 1,
        maxLength: MAX_PAIN_POINT_LENGTH,
      },
      maxItems: MAX_PAIN_POINTS,
    },
    disqualifier: {
      type: "string",
      maxLength: MAX_DISQUALIFIER_LENGTH,
    },
  },
} as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
