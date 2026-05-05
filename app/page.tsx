"use client";

import Link from "next/link";
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

const mockSidebarItems = [
  { label: "Overview", description: "Workspace state", active: true },
  { label: "Campaigns", description: "Targeting rules" },
  { label: "Settings", description: "Alerts and profile" },
];

const mockOverviewStats = [
  { label: "Active campaigns", value: "03" },
  { label: "Syncs running", value: "01" },
  { label: "Failed syncs", value: "00" },
  { label: "New strong leads", value: "04", highlight: true },
];

const mockUpcomingSyncs = [
  { name: "AI note-taking", date: "May 5, 7:30 PM", status: "QUEUED" },
  { name: "Support automation", date: "May 5, 9:15 PM", status: "COMPLETED" },
];

const mockStrongLeads = [
  {
    title: "Looking to replace our internal notes stack",
    meta: "AI note-taking / r/SaaS",
    score: "92",
    summary: "Needs API access and team rollout controls before the next vendor review.",
  },
  {
    title: "Ops lead asking for automation recommendations",
    meta: "Support automation / r/smallbusiness",
    score: "84",
    summary: "Pricing pressure and inbox volume are driving an active tool search this week.",
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
            <Link
              href="/login"
              className="hidden text-sm font-medium text-white hover:opacity-80 sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="group flex h-10 items-center justify-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-5 text-sm font-medium text-brand-green transition-all hover:bg-brand-green hover:text-black"
            >
              Start workspace
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
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
              <Link
                href="/signup"
                className="flex h-14 w-full items-center justify-center rounded-full bg-brand-green px-8 text-sm font-bold uppercase tracking-wider text-black transition-all hover:bg-brand-green-hover sm:w-auto"
              >
                Create workspace
              </Link>
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
                    app.redleadsai.com/app
                  </div>
                </div>
              </div>

              <div className="grid gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                <div className="rounded-[24px] bg-[linear-gradient(180deg,#121212_0%,#181818_100%)] p-4 text-white shadow-[rgba(0,0,0,0.45)_0px_10px_28px]">
                  <div className="rounded-[20px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="text-[24px] font-semibold tracking-[-0.07em]">
                          <span className="text-[#22c55e]">Redleads</span>
                          <span className="text-white">ai</span>
                        </div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b3b3b3]">
                          Workspace
                        </p>
                      </div>
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-[#1f1f1f] text-[#1ed760] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
                        <div className="h-2.5 w-2.5 rounded-full bg-current" />
                      </div>
                    </div>

                    <div className="mt-5 rounded-[18px] bg-[#121212] px-4 py-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">
                        Signed in
                      </p>
                      <p className="mt-1 truncate text-[14px] font-bold text-[#ffffff]">
                        operator@redleads.ai
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">
                      Navigation
                    </p>
                    <div className="mt-3 space-y-2">
                      {mockSidebarItems.map((item) => (
                        <MockSidebarItem
                          key={item.label}
                          active={item.active}
                          description={item.description}
                          label={item.label}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[20px] bg-[#181818] p-4 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#b3b3b3]">
                      Utility
                    </p>
                    <div className="mt-4 rounded-[18px] bg-[#121212] p-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
                      <p className="text-[13px] font-bold text-[#ffffff]">Session active</p>
                      <p className="text-[11px] text-[#b3b3b3]">Leave the workspace safely.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[32px] border border-[#27272a] bg-[linear-gradient(180deg,rgba(15,15,17,0.94),rgba(9,9,10,0.98))] p-4 shadow-[0_32px_90px_rgba(0,0,0,0.48)] lg:p-5">
                  <div className="rounded-[28px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#b3b3b3]">
                          Overview
                        </p>
                        <h3 className="mt-3 text-[28px] font-bold tracking-[-0.04em] text-[#fdfdfd]">
                          Workspace snapshot
                        </h3>
                        <p className="mt-3 text-[15px] leading-6 text-[#cbcbcb]">
                          Signed in as operator@redleads.ai.
                        </p>
                      </div>
                      <div className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1ed760] px-5 text-[13px] font-bold uppercase tracking-[0.16em] text-[#121212]">
                        Open campaigns
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 xl:grid-cols-4">
                    {mockOverviewStats.map((item) => (
                      <MockOverviewStat key={item.label} {...item} />
                    ))}
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                    <MockSectionCard
                      description="The next campaigns expected to run on the daily sync cadence."
                      title="Upcoming syncs"
                    >
                      <div className="space-y-3">
                        {mockUpcomingSyncs.map((item) => (
                          <MockSyncRow key={item.name} {...item} />
                        ))}
                      </div>
                    </MockSectionCard>

                    <MockSectionCard
                      description="Latest high-intent leads that already cleared the visible score threshold."
                      title="Recent strong leads"
                    >
                      <div className="space-y-3">
                        {mockStrongLeads.map((lead) => (
                          <MockLeadRow key={lead.title} {...lead} />
                        ))}
                      </div>
                    </MockSectionCard>
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
                <Link
                  href="/signup"
                  className="flex h-14 w-full items-center justify-center rounded-full bg-brand-green px-8 text-sm font-bold uppercase tracking-wider text-black transition-all hover:scale-105 hover:bg-brand-green-hover sm:w-auto"
                >
                  Start your workspace
                </Link>
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

function MockSidebarItem({
  active = false,
  description,
  label,
}: {
  active?: boolean;
  description: string;
  label: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-full px-3 py-3 ${
        active
          ? "bg-[#1f1f1f] text-[#ffffff] shadow-[rgba(0,0,0,0.3)_0px_8px_8px]"
          : "text-[#b3b3b3]"
      }`}
    >
      <div
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
          active
            ? "bg-[#121212] text-[#ffffff] shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]"
            : "bg-[#1f1f1f] text-[#b3b3b3]"
        }`}
      >
        <div className="h-2.5 w-2.5 rounded-full bg-current" />
      </div>
      <div className="min-w-0">
        <p className={`text-[14px] leading-none ${active ? "font-bold" : "font-normal"}`}>{label}</p>
        <p className="mt-1 text-[12px] leading-4 text-[#b3b3b3]">{description}</p>
      </div>
    </div>
  );
}

function MockOverviewStat({
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

function MockSectionCard({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-[24px] bg-[#181818] p-5 shadow-[rgba(0,0,0,0.3)_0px_8px_8px]">
      <div className="border-b border-white/8 pb-5">
        <h3 className="text-[24px] font-bold tracking-tight text-[#ffffff]">{title}</h3>
        <p className="mt-2 text-[14px] leading-6 text-[#cbcbcb]">{description}</p>
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}

function MockSyncRow({
  date,
  name,
  status,
}: {
  date: string;
  name: string;
  status: string;
}) {
  const tone = status === "COMPLETED" ? "text-[#1ed760]" : "text-[#ffffff]";

  return (
    <div className="flex items-center justify-between gap-4 rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <div>
        <p className="text-[13px] font-bold text-[#fdfdfd]">{name}</p>
        <p className="mt-1 text-[12px] text-[#b3b3b3]">{date}</p>
      </div>
      <span className={`rounded-full bg-[#1f1f1f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone}`}>
        {status}
      </span>
    </div>
  );
}

function MockLeadRow({
  meta,
  score,
  summary,
  title,
}: {
  meta: string;
  score: string;
  summary: string;
  title: string;
}) {
  return (
    <div className="rounded-[18px] bg-[#121212] px-4 py-4 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[#fdfdfd]">{title}</p>
          <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-[#b3b3b3]">{meta}</p>
        </div>
        <span className="rounded-full bg-[#1f1f1f] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1ed760]">
          {score}
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-6 text-[#cbcbcb]">{summary}</p>
    </div>
  );
}
