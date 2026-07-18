Bro, this is the exact framework I use to create 300 semantic queries for your Reddit lead-finder SaaS.

The goal is not to generate 300 keywords. The goal is to create 300 different ways a real Reddit user might describe the same buying needs.

1. First define exactly what counts as a lead

Before writing queries, I define:

Target customer

Who is expected to write the Reddit post?

Example for commercial insurance:

Business owner
Founder
Contractor
Restaurant owner
Ecommerce seller
Property manager
Operations manager
Service provider

Who will pay for the leads?

Commercial insurance broker
Bookkeeping firm
Payment processor
Cybersecurity consultancy
Strong lead

A strong lead normally has:

A real business
A current problem
A service the provider can solve
Some intention to hire, compare, switch, or purchase
A trigger or deadline

Example:

Need general liability insurance before signing a client contract.

Weak lead

A weak lead may discuss the subject but has no commercial intent.

Example:

How does commercial insurance work?

Excluded lead

Examples:

Students
Job seekers
Career questions
Homework
Service providers looking for clients
General news discussions
DIY questions with no willingness to hire
Personal or consumer problems

This definition controls the entire query pack.

2. Split the 300 queries into three language levels

We agreed on:

100 non-technical
100 semi-technical
100 technical

This matters because Reddit users describe the same problem differently.

Non-technical queries

These sound like ordinary business owners.

Examples:

need insurance before signing a contract
my business books are months behind
customer wants proof that our company is secure
Stripe is holding our business money

They usually do not know the exact product or technical term.

Semi-technical queries

These users understand the common service terminology.

Examples:

need general liability coverage for a contractor
looking for QuickBooks cleanup services
need SOC 2 readiness support
looking for a high risk merchant account

They know what kind of service they need, but they are not specialists.

Technical queries

These sound like experienced operators, finance leaders, IT leaders, compliance managers, or specialists.

Examples:

need claims made E&O with prior acts coverage
need ASC 606 deferred revenue reconciliation
need SOC 2 Type II operating effectiveness support
need interchange optimization for card processing

This three-level structure prevents your campaign from only matching highly technical posts.

3. Build service-intent buckets before writing queries

I do not write 300 random queries. First, I divide the company’s services into intent buckets.

For commercial insurance, for example:

New business insurance
Contract requirements
Certificates of insurance
General liability
Workers’ compensation
Commercial property
Professional liability
Commercial auto
Cyber insurance
Product liability
D&O and EPLI
Expensive renewal
Carrier non-renewal
Rejected applications
Claims problems
Hard-to-place industries
Broker replacement
Industry-specific insurance

Then queries are distributed across these buckets.

This avoids creating 80 queries about general liability and only three about cyber insurance.

4. Cover the main lead-intent patterns

For nearly every B2B service, I create queries around these patterns.

Direct hiring intent
looking for a commercial insurance broker
need someone to clean up our QuickBooks
looking for a virtual CISO
need a new payment processor

These are usually the strongest leads.

Recommendation requests
can anyone recommend a business insurance broker
best bookkeeper for an ecommerce company
recommend a SOC 2 consultant
what payment processor should I use
Replacement intent
looking to replace our insurance broker
current bookkeeper keeps making mistakes
need an alternative to our cybersecurity consultant
want to switch away from Stripe
Comparison intent
comparing business insurance quotes
bookkeeper or fractional CFO
SOC 2 consultant versus compliance platform
Square or Clover for a restaurant
Active pain
insurance premium doubled at renewal
books are six months behind
enterprise deal blocked by security review
processor is holding our payouts
Trigger events

These are extremely valuable because they create urgency.

Examples:

Starting a business
Hiring employees
Signing an enterprise client
Opening a new location
Tax deadline
Fundraising
Audit
Insurance renewal
Account termination
Security breach
Loan application
Customer contract
Landlord requirement

Example queries:

hiring my first employee and need workers comp
need clean financials before raising money
customer requires SOC 2 before signing
processor terminated us before a large launch
Urgency
need a certificate of insurance today
books need to be fixed before tax filing
SOC 2 deadline is next month
need a replacement processor immediately
Cost dissatisfaction
business insurance renewal is too expensive
bookkeeper charges too much for basic work
SOC 2 consultant quote seems excessive
payment processing fees are killing margins
Rejection or difficult placement
keep getting rejected for commercial insurance
no bookkeeper wants to clean up these old records
failed our security audit and need help
every processor rejects our business category
5. Add industry-specific variations

Generic queries are useful, but industries describe problems differently.

For example, commercial insurance queries should include:

Contractors
Construction
Roofing
HVAC
Restaurants
Food trucks
Trucking
Ecommerce
SaaS
Healthcare
Property management
Manufacturing
Professional services
Salons
Nonprofits

Examples:

roofing company cannot find affordable liability insurance
SaaS startup needs cyber and technology E&O
restaurant needs liquor liability coverage
Amazon seller needs product liability insurance

However, I avoid making every query industry-specific. Otherwise, the embeddings become too narrow.

A useful balance is:

40% broad business problems
35% service and workflow-specific
25% industry-specific

This can change depending on the niche.

6. Keep each query semantically clean

A good semantic query normally contains:

One business situation + one main intent or pain

Good:

need workers comp before hiring employees

Bad:

need workers comp general liability commercial auto cyber insurance and property coverage for my growing company

The bad query mixes too many concepts. Its embedding becomes an average of several different meanings.

Preferred query length

Most queries should be approximately:

6–14 words
Occasionally up to 18 words for technical queries
Use natural phrasing

Good:

insurance company will not renew my business policy

Too artificial:

seeking comprehensive commercial risk-transfer solutions from an experienced brokerage

Real Reddit users rarely speak like a company website.

7. Generate linguistic variations without creating duplicates

I vary four things:

Intent words
Need
Looking for
Searching for
Can anyone recommend
Trying to find
Considering
Want to replace
Comparing
Problem wording
Books are behind
Records are messy
QuickBooks is incorrect
Accounts are not reconciled
Business context
Small business
SaaS startup
Contractor
Restaurant
Ecommerce store
Medical practice
Trigger wording
Before signing a contract
Before tax filing
Before fundraising
Before hiring
Before renewal
After being rejected

But I remove superficial duplicates.

These two are almost the same:

need a bookkeeper for my small business
looking for a small business bookkeeper

Only one may be necessary unless testing shows that both wording patterns retrieve meaningfully different posts.

8. Avoid keyword-only queries

Weak semantic queries:

workers compensation
SOC 2
QuickBooks
merchant account
cyber insurance

These describe topics, not buying situations.

Better:

need workers compensation before hiring employees
customer requires SOC 2 before signing
need someone to clean up QuickBooks
looking for a merchant account after Stripe termination
client requires cyber insurance for the contract

The second set contains context and intent.

9. Balance broad recall and strong precision

Your queries need both.

Broad recall queries

These catch users who do not know the correct term.

need someone to organize my business finances
client wants proof that our business is insured
need help protecting our company data
payment company is holding our money
High-precision queries

These catch obvious buyers.

looking for monthly outsourced bookkeeping
need commercial general liability before signing a contract
need SOC 2 Type II readiness support
need a high risk merchant account after termination

For 300 queries, a useful balance is:

100 broad pain and natural-language queries
120 direct service and buying-intent queries
80 technical, industry-specific, and edge-case queries

The language-level split still remains 100/100/100. These dimensions overlap.

10. Include both visible and hidden buying signals

Some users explicitly say they want to hire someone.

looking for a commercial insurance broker

Others reveal a problem that strongly implies a provider is needed.

client requires a certificate of insurance by Friday

The second user may not say “broker,” but they are still a strong lead.

I therefore create queries for:

Explicit provider searches
Current operational pain
External requirements
Deadlines
Failed DIY attempts
Rejection or termination
Growth events
Risk events
11. Do not make all technical queries excessively technical

Technical queries should still represent commercial buying intent.

Good:

need SOC 2 Type II evidence collection support

Bad:

how does the AICPA define operating effectiveness

The bad one is educational, not a service-buying query.

Good:

need claims made E&O with prior acts coverage

Bad:

difference between occurrence and claims made insurance

A technical query should still answer:

Why might this person pay a provider?

12. Use exclusions in the classifier, not only semantic search

Semantic search will inevitably return some related but irrelevant posts.

For bookkeeping, exclude:

how to become a bookkeeper
accounting homework help
looking for a bookkeeping job

For cybersecurity, exclude:

how to start a cybersecurity career
studying for Security Plus
how do I hack this website

For insurance, exclude:

how to become an insurance agent
personal car insurance claim
insurance licensing exam advice

Your LLM classifier should check:

{
  "isBusinessBuyer": true,
  "hasActiveNeed": true,
  "serviceFit": true,
  "buyingIntent": "high",
  "exclusionReason": null
}

Do not try to solve every exclusion using negative semantic queries. Your classifier is better suited for final qualification.

13. Structure the final query JSON correctly

Use this format:

{
  "semanticQueries": [
    {
      "category": "contract-requirement",
      "technicalLevel": "non-technical",
      "text": "need insurance before signing a client contract"
    },
    {
      "category": "professional-liability",
      "technicalLevel": "semi-technical",
      "text": "need errors and omissions coverage for consultants"
    },
    {
      "category": "professional-liability",
      "technicalLevel": "technical",
      "text": "need claims made E&O with prior acts coverage"
    }
  ]
}

The category helps you later determine which types of queries produce leads.

14. Quality checks before using the pack

Before importing the 300 queries, check:

Exact duplication

No repeated query text.

Semantic duplication

Remove queries that express almost exactly the same intent.

Category balance

Ensure no single service dominates the pack accidentally.

Language balance

Verify there are exactly:

100 non-technical
100 semi-technical
100 technical
Buying intent

Every query should represent one of:

Buying
Hiring
Comparing
Replacing
Solving an urgent pain
Meeting a requirement
Recovering from a failure
Reddit realism

Ask:

Could a real Reddit post contain language close to this?

Provider fit

Ask:

Could the campaign’s service provider genuinely solve this problem?

15. How to test whether the 300 queries are good

Do not judge the pack only by how many posts cross the threshold.

Track:

Total posts processed
Posts above semantic threshold
Unique posts above threshold
Qualified leads after LLM classification
Strong leads
False positives
Matched semantic query
Query category
Maximum similarity score
Subreddit
Industry
Lead intent

Most important metric:

Strong unique leads per 1,000 Reddit posts

Also track:

How many different intent categories produced at least one good lead?

A pack finding 10 leads from eight different intent categories may be healthier than a pack finding 12 nearly identical leads about one topic.

16. Keep your threshold fixed during comparisons

For the first comparison, keep the threshold at:

0.50

Test different query packs against the same frozen Reddit-post dataset.

Do not simultaneously change:

Query pack
Threshold
Embedding model
Top-K
Classifier prompt
Subreddit list

Otherwise, you will not know what caused the improvement.

17. Diagnose missed posts by similarity score

When reviewing known good leads:

Score around 0.47–0.49

Your query coverage is probably decent, but the threshold may be slightly high.

Score below approximately 0.44

The query pack probably lacks the language or intent cluster used by that post.

Score above 0.50 but post is missing from the output

Check:

Top-K limits
Deduplication
Database filtering
Date filters
LLM classifier
Campaign geography
Downstream code
Reusable generation workflow

Use this every time:

1. Research what the business sells.
2. Identify the exact buyer personas.
3. Define strong, medium, weak and excluded leads.
4. Break services into 10–20 intent buckets.
5. List the main trigger events.
6. List direct hiring, replacement, comparison and pain patterns.
7. Add relevant industry variations.
8. Generate 100 non-technical queries.
9. Generate 100 semi-technical queries.
10. Generate 100 technical queries.
11. Remove exact and semantic duplicates.
12. Check category and industry balance.
13. Export structured JSON.
14. Test on a frozen Reddit corpus at threshold 0.50.
15. Review misses and create targeted queries for uncovered language.
Reusable master prompt

You can use this prompt in the future:

Create 300 semantic queries for a Reddit lead-finder campaign targeting [SERVICE PROVIDER TYPE].

Business description:
[PASTE DETAILED BUSINESS DESCRIPTION]

Generate:
- 100 non-technical queries
- 100 semi-technical queries
- 100 technical queries

The queries must be optimized for semantic matching against Reddit posts.

Requirements:
1. Write queries in natural Reddit-style language, not marketing language.
2. Each query should contain one dominant business problem, buying intent, workflow, requirement, or trigger event.
3. Most queries should be between 6 and 14 words.
4. Cover direct hiring, recommendations, comparisons, replacement, dissatisfaction, urgent problems, rejected applications, external requirements, deadlines, growth events, and failed DIY attempts.
5. Include broad business-owner language, service-specific terminology, technical terminology, and relevant industry-specific variations.
6. Do not create keyword-only queries.
7. Avoid queries that combine multiple unrelated services.
8. Avoid exact duplicates and semantically redundant queries.
9. Technical queries must still represent commercial service-buying intent, not educational discussions.
10. Exclude career questions, students, job seekers, homework, providers seeking clients, consumer questions, and general discussions without buying intent.
11. Balance query coverage across every important service category.
12. Return valid JSON in this format:

{
  "semanticQueries": [
    {
      "category": "category-name",
      "technicalLevel": "non-technical",
      "text": "natural Reddit-style semantic query"
    }
  ]
}

The most important rule is:

Do not generate 300 descriptions of the service. Generate 300 realistic situations in which someone would need, compare, replace, or purchase the service.
