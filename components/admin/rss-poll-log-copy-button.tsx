"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export function RssPollLogCopyButton({ payload }: { payload: unknown }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyToClipboard(JSON.stringify(payload, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button aria-label="Copy RSS polling logs JSON" onClick={handleCopy} size="sm" type="button" variant="secondary">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : "Copy JSON"}
    </Button>
  );
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}
