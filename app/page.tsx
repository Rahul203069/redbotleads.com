"use client";

import { motion } from "motion/react";
import {
  ArrowRight,
  Bell,
  Filter,
  Search,
  Zap,
  LayoutDashboard,
} from "lucide-react";

const proofStats = [
  { label: "Signal-first", value: "24h sync cadence" },
  { label: "AI qualified", value: "Lead scoring built in" },
  { label: "Delivery", value: "Slack alerts on threshold" },
];

const featureCards = [
  {
    icon: Search,
    eyebrow: "Discovery",
    title: "Monitor trusted communities.",
    copy: "Track target subreddits, surface new posts daily, and keep your workflow focused on fresh signals.",
  },
  {
    icon: Filter,
    eyebrow: "Qualification",
    title: "Filter out the noise.",
    copy: "Semantic filtering and LLM scoring narrow the pipeline to commercially relevant posts.",
  },
  {
    icon: Bell,
    eyebrow: "Action",
    title: "Route leads directly.",
    copy: "Send alerts straight into Slack when a lead crosses the campaign threshold to ensure fast follow-up.",
  },
];

const workflowSteps = [
  {
    title: "Choose subreddits",
    copy: "Define the communities, terms, and exclusions that match your category.",
  },
  {
    title: "Sync and classify",
    copy: "The pipeline fetches posts, filters for relevance, and scores them for intent.",
  },
  {
    title: "Review strong leads",
    copy: "Your team gets the short list, not the full firehose.",
  },
];

export default function Page() {
  return (
    <div className="relative min-h-screen bg-[#050505] text-white selection:bg-brand-green/30">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-brand-green/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-brand-green/5 blur-[150px]" />
        <div className="absolute left-[20%] top-[30%] h-[300px] w-[300px] rounded-full bg-white/5 blur-[100px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-6 lg:px-8">
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="sticky top-6 z-50 flex items-center justify-between rounded-full border border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl supports-[backdrop-filter]:bg-black/20"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-green">
              <Zap className="h-5 w-5 text-black" fill="currentColor" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">
              redleadsai
            </span>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <a href="#" className="text-sm font-medium text-zinc-400 hover:text-white">
              Features
            </a>
            <a href="#" className="text-sm font-medium text-zinc-400 hover:text-white">
              How it works
            </a>
            <a href="#" className="text-sm font-medium text-zinc-400 hover:text-white">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-3">
            <a href="#" className="hidden text-sm font-medium text-white hover:opacity-80 sm:block">
              Sign in
            </a>
            <a
              href="#"
              className="group flex h-10 items-center justify-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-5 text-sm font-medium text-brand-green transition-all hover:bg-brand-green hover:text-black"
            >
              Start workspace
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </motion.header>

        <section className="relative pb-16 pt-24 md:pt-32 lg:pt-40">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mb-8 flex justify-center"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-300">
                <span className="flex h-2 w-2 rounded-full bg-brand-green" />
                Reddit lead intelligence is live
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              className="font-display text-5xl font-bold tracking-[-0.04em] sm:text-6xl md:text-7xl lg:text-[5.5rem] lg:leading-[0.95]"
            >
              Find buying intent on{" "}
              <span className="text-brand-green">Reddit</span> before it
              disappears.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              className="mx-auto mt-8 max-w-2xl text-lg text-zinc-400 sm:text-xl"
            >
              Redleadsai helps you monitor selected subreddits, filter weak
              matches, score stronger ones with AI, and push real leads into a
              workflow your team can act on.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <a
                href="#"
                className="flex h-14 w-full items-center justify-center rounded-full bg-brand-green px-8 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-brand-green-hover sm:w-auto"
              >
                Create workspace
              </a>
              <a
                href="#"
                className="flex h-14 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 text-sm font-bold uppercase tracking-wider text-white transition-all hover:border-white/20 hover:bg-white/10 sm:w-auto"
              >
                See how it works
              </a>
            </motion.div>
          </div>
        </section>

        <section className="relative mt-12 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="group relative mx-auto max-w-5xl"
          >
            <div className="absolute -inset-4 rounded-[40px] bg-brand-green/20 blur-2xl transition-all duration-500 group-hover:bg-brand-green/30" />

            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0a0a0a] shadow-2xl">
              <div className="flex items-center border-b border-white/5 bg-[#141414] px-6 py-4">
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-zinc-700" />
                  <div className="h-3 w-3 rounded-full bg-zinc-700" />
                  <div className="h-3 w-3 rounded-full bg-zinc-700" />
                </div>

                <div className="flex flex-1 justify-center">
                  <div className="flex items-center gap-2 rounded-md bg-black/50 px-4 py-1 text-xs font-medium text-zinc-500">
                    <LayoutDashboard className="h-3 w-3" />
                    app.redleadsai.com/workspace
                  </div>
                </div>
              </div>

              <div className="p-8">
                <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-brand-green">
                      Live pipeline
                    </div>
                    <div className="mt-1 font-display text-2xl font-semibold">
                      Buyer-signal workspace
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-green" />
                    </span>
                    <span className="font-mono text-xs font-medium text-brand-green">
                      Active Sync
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <MiniMetric value="1,248" label="Posts Scraped (24h)" />
                  <MiniMetric value="32" label="Qualified Leads" />
                  <MiniMetric value="04" label="Strong Matches" highlight />
                </div>

                <div className="mt-8">
                  <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-2">
                    <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400">
                      Recent Strong Matches
                    </h3>
                    <button className="text-xs font-medium text-brand-green hover:underline">
                      View All
                    </button>
                  </div>

                  <div className="relative space-y-3">
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-[#0a0a0a] to-transparent" />

                    <SignalRow
                      campaign="AI note-taking"
                      subreddit="r/SaaS"
                      score="94"
                      summary="Looking to replace an internal notes stack after trial fatigue. Needs API access."
                      time="12m ago"
                    />
                    <SignalRow
                      campaign="Dev tooling"
                      subreddit="r/reactjs"
                      score="88"
                      summary="Founder comparing workflow tools before a broader engineering team rollout."
                      time="1h ago"
                    />
                    <SignalRow
                      campaign="Support automation"
                      subreddit="r/smallbusiness"
                      score="82"
                      summary="Ops lead asking for recommendations before switching vendors due to pricing."
                      time="4h ago"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="border-y border-white/5 py-12">
          <div className="grid gap-8 divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {proofStats.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="flex flex-col items-center justify-center p-4 text-center sm:p-0"
              >
                <div className="font-mono text-sm uppercase tracking-widest text-zinc-500">
                  {item.label}
                </div>
                <div className="mt-2 font-display text-xl font-medium text-white">
                  {item.value}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="py-24">
          <div className="mb-16 text-center">
            <h2 className="font-display text-3xl font-bold sm:text-5xl">
              Engineered for pure signal.
            </h2>
            <p className="mt-4 text-zinc-400">
              Stop scrolling, start selling. We handle the noise.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {featureCards.map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[#121212] p-8 transition-colors hover:bg-[#161616]"
              >
                <div className="absolute right-0 top-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-brand-green/10 blur-2xl transition-transform group-hover:scale-150" />

                <div className="relative z-10">
                  <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <card.icon className="h-6 w-6 text-brand-green" />
                  </div>
                  <div className="mb-2 font-mono text-xs uppercase tracking-widest text-zinc-500">
                    {card.eyebrow}
                  </div>
                  <h3 className="mb-4 font-display text-2xl font-semibold text-white">
                    {card.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    {card.copy}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex flex-col justify-center"
            >
              <div className="mb-4 font-mono text-xs uppercase tracking-widest text-brand-green">
                Why it works
              </div>
              <h2 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
                The workflow stays narrow on purpose.
              </h2>
              <p className="mt-6 text-lg text-zinc-400">
                Instead of pushing every Reddit mention into a noisy inbox, the
                workspace keeps the path tight: discover, filter, classify, then
                notify when the signal is strong enough to justify attention.
              </p>
            </motion.div>

            <div className="space-y-6">
              {workflowSteps.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  className="flex gap-6 rounded-3xl border border-white/10 bg-[#121212] p-6 lg:p-8"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-green/10 font-mono text-base font-bold text-brand-green">
                    0{index + 1}
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-white">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-zinc-400">{step.copy}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#121212] px-8 py-20 text-center shadow-2xl sm:px-16"
          >
            <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-brand-green/10 blur-[80px]" />
            <div className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-brand-green/5 blur-[80px]" />

            <div className="relative z-10 mx-auto max-w-2xl">
              <h2 className="font-display text-4xl font-bold sm:text-5xl">
                Build a quieter Reddit lead pipeline.
              </h2>
              <p className="mt-6 text-lg text-zinc-400">
                Define a campaign and let the workspace keep watch while your
                team stays focused on the leads worth acting on.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a
                  href="#"
                  className="flex h-14 w-full items-center justify-center rounded-full bg-brand-green px-8 text-sm font-bold uppercase tracking-wider text-black transition-all hover:scale-105 hover:bg-brand-green-hover sm:w-auto"
                >
                  Start your workspace
                </a>
              </div>
            </div>
          </motion.div>
        </section>

        <footer className="flex flex-col items-center justify-between border-t border-white/10 py-8 sm:flex-row">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-brand-green" fill="currentColor" />
            <span className="font-display font-medium text-white">
              redleadsai
            </span>
          </div>
          <div className="mt-4 text-sm text-zinc-500 sm:mt-0">
            © {new Date().getFullYear()} Redleadsai. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? "border-brand-green/30 bg-brand-green/5"
          : "border-white/5 bg-[#1a1a1a]"
      }`}
    >
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div
        className={`mt-3 font-display text-4xl font-semibold tracking-tight ${
          highlight ? "text-brand-green" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SignalRow({
  campaign,
  score,
  subreddit,
  summary,
  time,
}: {
  campaign: string;
  score: string;
  subreddit: string;
  summary: string;
  time: string;
}) {
  return (
    <div className="group flex flex-col gap-4 rounded-2xl border border-white/5 bg-[#181818] p-5 transition-all hover:border-brand-green/30 hover:bg-[#1c1c1c] sm:flex-row sm:items-start">
      <div className="flex flex-col items-center justify-center rounded-xl bg-brand-green/10 p-3 ring-1 ring-brand-green/20">
        <span className="font-mono text-xs font-semibold text-brand-green">
          SCORE
        </span>
        <span className="font-display text-xl font-bold text-white">
          {score}
        </span>
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-display text-sm font-semibold text-white">
              {campaign}
            </h4>
            <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
              {subreddit}
            </span>
          </div>
          <span className="font-mono text-[10px] text-zinc-500">{time}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {summary}
        </p>
      </div>
    </div>
  );
}