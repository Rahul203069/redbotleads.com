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
    const next = normalizeValue(rawValue);

    if (!next || value.includes(next)) {
      return;
    }

    flushSync(() => {
      onChange([...value, next]);
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

  return (
    <div className="rounded-2xl border border-[#27312E] bg-[#111716] p-3">
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-2 rounded-full border border-[#2f3b37] bg-[#161D1B] px-3 py-1.5 text-sm text-[#C3CBC8]"
          >
            <span>{tag}</span>
            <button
              aria-label={`Remove ${tag}`}
              className="text-[#6F7C77] transition hover:text-[#F3F5F4]"
              onClick={() => removeTag(tag)}
              type="button"
            >
              x
            </button>
          </span>
        ))}
        <input
          className={cn(
            "min-w-[180px] flex-1 bg-transparent px-1 py-1 text-sm text-[#F3F5F4] outline-none placeholder:text-[#6F7C77]",
            value.length === 0 ? "min-h-8" : "",
          )}
          onBlur={() => commitTag(draft)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          value={draft}
        />
      </div>
      {label ? <p className="mt-3 text-xs text-[#6F7C77]">{label}</p> : null}
      {draft.trim().length > 0 ? (
        <p className="mt-2 text-xs text-[#9DA9A4]">
          Pending: <span className="text-[#F3F5F4]">{normalizeValue(draft)}</span>
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
  return value.trim().toLowerCase().replace(/^r\//, "");
}
