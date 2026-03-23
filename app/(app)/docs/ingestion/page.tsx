import { readFile } from "node:fs/promises";
import path from "node:path";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";

export default async function IngestionDocPage() {
  const markdownPath = path.join(process.cwd(), "worker", "INGESTION.md");
  const markdown = await readFile(markdownPath, "utf8");

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-[#27312E] bg-[#111716]/92 p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)] lg:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-[#d4d4d8]">Worker docs</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#F3F5F4] lg:text-4xl">Ingestion flow</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#9DA9A4] lg:text-base">
          Product-facing view of the ingestion worker behavior, fetch strategy, heuristics, dedupe rules, and AI handoff.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Worker reference</CardTitle>
          <CardDescription>
            This page renders <code className="rounded bg-[#161D1B] px-1.5 py-0.5 text-[#F3F5F4]">worker/INGESTION.md</code> inside the app UI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[24px] border border-[#27312E] bg-[#111716] p-6 lg:p-8">
            <MarkdownRenderer markdown={markdown} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
