import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MessageCircle, ScanSearch, Sparkles } from "lucide-react";

import { BrandLogo } from "@/components/app/brand-logo";

export const metadata: Metadata = {
  title: "Find relevant conversations on Reddit and X | Redleadsai",
  description:
    "Find posts worth your attention on Reddit and X, understand the conversation, and show up with a useful response.",
};

const examples = [
  {
    platform: "Reddit",
    place: "r/smallbusiness",
    title: "How are you keeping client handoffs from getting lost?",
    context: "A team is looking for a better way to manage a recurring problem.",
    topic: "Operations",
    logo: "/reddit-mark.png",
  },
  {
    platform: "X",
    place: "Public conversation",
    title: "What tools actually make customer support easier for a small team?",
    context: "Someone is asking for practical recommendations and real experience.",
    topic: "Customer support",
    logo: "/x-mark.svg",
  },
] as const;

const features = [
  {
    icon: ScanSearch,
    number: "01",
    title: "Spot the right posts",
    copy: "Find discussions connected to the problems your business solves, instead of hunting through a crowded feed.",
  },
  {
    icon: Sparkles,
    number: "02",
    title: "Understand the context",
    copy: "See what people are asking for and why a conversation may be relevant before you decide to take part.",
  },
  {
    icon: MessageCircle,
    number: "03",
    title: "Join with something useful",
    copy: "Bring your expertise to the discussion with a helpful response that fits the moment.",
  },
] as const;

const steps = [
  ["01", "Set your focus", "Start with the topics and customer problems that matter to your business."],
  ["02", "Review relevant posts", "Look at the conversation and decide where your knowledge can add value."],
  ["03", "Join thoughtfully", "Respond in your own voice and make the exchange useful for the person who asked."],
] as const;

function PlatformMark({ platform, logo }: { platform: "Reddit" | "X"; logo: string }) {
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${platform === "Reddit" ? "bg-white" : "bg-black"}`}>
      <Image src={logo} alt="" width={platform === "Reddit" ? 29 : 24} height={platform === "Reddit" ? 29 : 24} className={platform === "Reddit" ? "h-[29px] w-[29px]" : "h-6 w-6"} />
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#050505] text-white selection:bg-brand-green/30">
      <a href="#main" className="sr-only rounded-lg bg-brand-green px-4 py-2 font-semibold text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]">
        Skip to content
      </a>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[850px] overflow-hidden">
        <div className="absolute -left-40 -top-72 h-[660px] w-[660px] rounded-full bg-brand-green/[0.09] blur-[130px]" />
        <div className="absolute -right-52 top-28 h-[660px] w-[660px] rounded-full bg-brand-green/[0.07] blur-[145px]" />
      </div>

      <header className="relative z-20 border-b border-white/10 bg-[#070807]/85 backdrop-blur-xl">
        <nav aria-label="Main navigation" className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link href="/" aria-label="Redleadsai home" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-4 focus-visible:ring-offset-black">
            <BrandLogo showMark className="text-xl font-bold tracking-[-0.06em]" />
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="rounded text-sm font-medium text-zinc-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green">Why Redleadsai</a>
            <a href="#how-it-works" className="rounded text-sm font-medium text-zinc-300 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green">How it works</a>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <Link href="/login" className="hidden rounded text-sm font-medium text-zinc-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green sm:inline-flex">Sign in</Link>
            <Link href="/signup" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-green px-4 text-sm font-semibold text-black transition-colors hover:bg-brand-green-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green sm:px-5">
              <span className="min-[420px]:hidden">Get started</span>
              <span className="hidden min-[420px]:inline">Create workspace</span>
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </nav>
      </header>

      <main id="main" className="relative z-10">
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-20 sm:px-8 sm:pt-24 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16 lg:pb-32 lg:pt-32">
          <div>
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-brand-green/25 bg-brand-green/[0.07] px-3 py-2 text-xs font-semibold text-brand-green sm:px-4">
              <span className="flex items-center gap-1.5"><Image src="/reddit-mark.png" alt="" width={20} height={20} className="h-5 w-5" />Reddit</span>
              <span aria-hidden="true" className="text-zinc-500">+</span>
              <span className="flex items-center gap-1.5"><span className="grid h-5 w-5 place-items-center rounded bg-black"><Image src="/x-mark.svg" alt="" width={12} height={12} className="h-3 w-3" /></span>X</span>
              <span className="ml-1 text-zinc-300">Conversation discovery</span>
            </div>
            <h1 className="mt-7 max-w-[11ch] font-display text-5xl font-bold leading-[1.04] tracking-[-0.055em] sm:text-6xl lg:text-[5.3rem]">
              Find the conversations <span className="text-brand-green">worth joining</span> on Reddit and X.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-300 sm:text-xl">
              Spot posts where people are talking about problems your business can help solve. Understand the context, then show up with something useful to say.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/signup" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-brand-green px-7 text-sm font-bold text-black transition-colors hover:bg-brand-green-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green">
                Create workspace <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <a href="#how-it-works" className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/15 px-7 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green">See how it works</a>
            </div>
            <p className="mt-6 text-sm text-zinc-500">Useful conversations start with listening.</p>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div aria-hidden="true" className="absolute inset-7 rounded-[48px] bg-brand-green/15 blur-[70px]" />
            <div className="relative rounded-[30px] border border-white/10 bg-[#0c0e0d] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:p-6">
              <div className="border-b border-white/10 px-1 pb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-green">A closer look</p>
                <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">Conversations worth your attention</h2>
              </div>
              <div className="mt-5 space-y-3">
                {examples.map((example) => (
                  <article key={example.platform} className="rounded-2xl border border-white/10 bg-[#141715] p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <PlatformMark platform={example.platform} logo={example.logo} />
                        <span><span className="block text-sm font-semibold text-white">{example.platform}</span><span className="block text-xs text-zinc-500">{example.place}</span></span>
                      </div>
                      <span className="rounded-full border border-brand-green/20 bg-brand-green/[0.07] px-3 py-1 text-xs font-medium text-brand-green">{example.topic}</span>
                    </div>
                    <h3 className="mt-5 text-base font-semibold leading-6 text-white sm:text-lg">{example.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{example.context}</p>
                  </article>
                ))}
              </div>
              <p className="px-1 pt-4 text-xs text-zinc-500">Illustrative examples of the conversations businesses look for.</p>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-24 border-y border-white/10 bg-[#0b0d0b] py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-green">From noise to opportunity</p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-[-0.04em] sm:text-5xl">Be part of the right conversation.</h2>
              <p className="mt-5 text-lg leading-8 text-zinc-400">A relevant post is an invitation to be helpful. Find the right moment and respond with the context it deserves.</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.number} className="rounded-3xl border border-white/10 bg-[#121512] p-6 sm:p-8">
                  <div className="flex items-start justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl border border-brand-green/20 bg-brand-green/10 text-brand-green"><feature.icon aria-hidden="true" className="h-6 w-6" /></span>
                    <span className="font-mono text-xs text-zinc-600">{feature.number}</span>
                  </div>
                  <h3 className="mt-9 font-display text-2xl font-semibold tracking-tight">{feature.title}</h3>
                  <p className="mt-4 text-base leading-7 text-zinc-400">{feature.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-green">How it works</p>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-[-0.04em] sm:text-5xl">A simple path from discovery to dialogue.</h2>
            <p className="mt-6 text-lg leading-8 text-zinc-400">Keep your attention on people and their questions, rather than on another endless feed.</p>
          </div>
          <ol className="space-y-3">
            {steps.map(([number, title, copy]) => (
              <li key={number} className="flex gap-5 rounded-2xl border border-white/10 bg-[#111311] p-5 sm:gap-7 sm:p-7">
                <span className="font-mono text-sm font-bold text-brand-green">{number}</span>
                <div><h3 className="font-display text-xl font-semibold">{title}</h3><p className="mt-2 text-base leading-7 text-zinc-400">{copy}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="px-5 pb-20 sm:px-8 sm:pb-28">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[30px] border border-brand-green/20 bg-[#111a12] px-6 py-16 text-center sm:px-12 sm:py-20">
            <div aria-hidden="true" className="absolute -right-32 -top-40 h-[420px] w-[420px] rounded-full bg-brand-green/15 blur-[100px]" />
            <div className="relative mx-auto max-w-3xl">
              <h2 className="font-display text-3xl font-bold tracking-[-0.04em] sm:text-5xl">Your next customer conversation could already be happening.</h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-300">Find the posts that matter. Bring your perspective to the discussion.</p>
              <Link href="/signup" className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-brand-green px-8 text-sm font-bold text-black transition-colors hover:bg-brand-green-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green">
                Create workspace <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <BrandLogo showMark className="text-lg font-bold tracking-[-0.06em]" />
          <p>© {new Date().getFullYear()} Redleadsai. Platform marks belong to their respective owners.</p>
        </div>
      </footer>
    </div>
  );
}
