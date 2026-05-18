"use client";

import { useState } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TagInputProps = {
  label?: string;
  onChange: (values: string[]) => void;
  placeholder: string;
  value: string[];
};

export function TagInput({ label, onChange, placeholder, value }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function commitTag(rawValue: string) {
    const nextValues = splitValues(rawValue).filter((item) => !value.includes(item));

    if (nextValues.length === 0) {
      return;
    }

    flushSync(() => {
      onChange([...value, ...nextValues]);
    });
    setDraft("");
  }

  function removeTag(tag: string) {
    flushSync(() => {
      onChange(value.filter((item) => item !== tag));
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitTag(draft);
    }

    if (event.key === "Backspace" && draft.length === 0 && value.length > 0) {
      event.preventDefault();
      removeTag(value[value.length - 1]);
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");

    if (!/[,\r\n\t]/.test(pasted)) {
      return;
    }

    event.preventDefault();
    commitTag(pasted);
  }

  return (
    <div className="rounded-2xl border border-[#27272a] bg-[#09090b] p-3">
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-2 rounded-full border border-[#3f3f46] bg-[#18181b] px-3 py-1.5 text-sm text-[#e4e4e7]"
          >
            <span>{tag}</span>
            <button
              aria-label={`Remove ${tag}`}
              className="text-[#71717a] transition hover:text-[#fafafa]"
              onClick={() => removeTag(tag)}
              type="button"
            >
              x
            </button>
          </span>
        ))}
        <input
          className={cn(
            "min-w-[180px] flex-1 bg-transparent px-1 py-1 text-sm text-[#fafafa] outline-none placeholder:text-[#71717a]",
            value.length === 0 ? "min-h-8" : "",
          )}
          onBlur={() => commitTag(draft)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={value.length === 0 ? placeholder : ""}
          value={draft}
        />
      </div>
      {label ? <p className="mt-3 text-xs text-[#71717a]">{label}</p> : null}
      {draft.trim().length > 0 ? (
        <p className="mt-2 text-xs text-[#a1a1aa]">
          Pending: <span className="text-[#fafafa]">{normalizeValue(draft)}</span>
        </p>
      ) : null}
      {draft.trim().length > 0 ? (
        <div className="mt-3">
          <Button onClick={() => commitTag(draft)} size="sm" type="button" variant="secondary">
            Add
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase().replace(/^\/?r\//, "");
}

function splitValues(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\r\n\t]+/)
        .map((item) => normalizeValue(item))
        .filter(Boolean),
    ),
  );
}
