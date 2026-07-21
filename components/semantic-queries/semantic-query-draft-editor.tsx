"use client";

import { ClipboardPaste, Copy, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  cleanSemanticQueryRows,
  createSemanticQueryDraftRows,
  createSemanticQueryLocalId,
  MAX_SEMANTIC_QUERY_CATEGORY_LENGTH,
  MAX_SEMANTIC_QUERY_TEXT_LENGTH,
  parseSemanticQueryBulkInput,
  type SemanticQueryDraftRow,
} from "@/lib/semantic-queries";

type SemanticQueryDraftEditorProps = {
  disabled?: boolean;
  emptyMessage?: string;
  eyebrow?: string;
  listClassName?: string;
  onChange: (rows: SemanticQueryDraftRow[]) => void;
  onClear?: () => void;
  onCopy?: () => void | Promise<void>;
  onReset?: () => void;
  rows: SemanticQueryDraftRow[];
  title?: string;
};

export function SemanticQueryDraftEditor({
  disabled = false,
  emptyMessage = "Add at least one semantic query before continuing.",
  eyebrow = "Semantic queries",
  listClassName = "grid max-h-[300px] gap-3 overflow-y-auto overscroll-contain pr-1",
  onChange,
  onClear,
  onCopy,
  onReset,
  rows,
  title = "Manual semantic worker set",
}: SemanticQueryDraftEditorProps) {
  const { toast } = useToast();
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false);
  const [bulkPasteValue, setBulkPasteValue] = useState("");
  const actionButtonClassName = onClear || onCopy
    ? "min-h-11 cursor-pointer rounded-full"
    : "cursor-pointer rounded-full";

  function handleBulkPasteOpenChange(open: boolean) {
    setBulkPasteOpen(open);

    if (!open) {
      setBulkPasteValue("");
    }
  }

  function handleImportQueries() {
    const result = parseSemanticQueryBulkInput(bulkPasteValue);

    if (result.status === "error") {
      toast({
        title: "No valid semantic queries found",
        description: result.message,
        variant: "destructive",
      });
      return;
    }

    const mergedRows = cleanSemanticQueryRows([...rows, ...result.queries]);

    if (mergedRows.status === "error") {
      toast({
        title: "Semantic queries not imported",
        description: mergedRows.message,
        variant: "destructive",
      });
      return;
    }

    const currentRows = cleanSemanticQueryRows(rows);
    const currentCount = currentRows.status === "success" ? currentRows.queries.length : 0;
    const addedCount = Math.max(0, mergedRows.queries.length - currentCount);

    onChange(createSemanticQueryDraftRows(mergedRows.queries));
    setBulkPasteOpen(false);
    setBulkPasteValue("");
    toast({
      title: "Semantic queries imported",
      description: `${addedCount} new semantic ${addedCount === 1 ? "query was" : "queries were"} added to the draft.`,
    });
  }

  function updateRow(rowId: string, field: "category" | "text", value: string) {
    onChange(rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  }

  return (
    <>
      <div className="flex shrink-0 flex-col gap-3 border-b border-[#27272a] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b3b3b3]">{eyebrow}</p>
          <h3 className="mt-2 text-[17px] font-bold text-[#ffffff]">{title}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {onReset ? (
            <Button className={actionButtonClassName} disabled={disabled} onClick={onReset} size="sm" type="button" variant="secondary">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          ) : null}
          {onClear ? (
            <Button
              className={`${actionButtonClassName} text-[#f3727f] hover:border-[#f3727f]/40 hover:bg-[#f3727f]/10 hover:text-[#ff9aa5]`}
              disabled={disabled || rows.length === 0}
              onClick={onClear}
              size="sm"
              type="button"
              variant="secondary"
            >
              <Trash2 className="h-4 w-4" />
              Clear all
            </Button>
          ) : null}
          {onCopy ? (
            <Button
              className={actionButtonClassName}
              disabled={disabled || rows.length === 0}
              onClick={() => void onCopy()}
              size="sm"
              type="button"
              variant="secondary"
            >
              <Copy className="h-4 w-4" />
              Copy JSON
            </Button>
          ) : null}
          <Button
            className={actionButtonClassName}
            disabled={disabled}
            onClick={() => setBulkPasteOpen(true)}
            size="sm"
            type="button"
            variant="secondary"
          >
            <ClipboardPaste className="h-4 w-4" />
            Bulk paste
          </Button>
          <Button
            className={actionButtonClassName}
            disabled={disabled}
            onClick={() => onChange([...rows, { id: createSemanticQueryLocalId(), category: "", text: "" }])}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <div className={listClassName}>
        {rows.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#3f3f46] bg-[#121212] p-4 text-[13px] leading-5 text-[#b3b3b3]">
            {emptyMessage}
          </div>
        ) : (
          rows.map((row, index) => (
            <div className="rounded-[18px] bg-[#121212] p-3 shadow-[rgb(18,18,18)_0px_1px_0px,rgb(124,124,124)_0px_0px_0px_1px_inset]" key={row.id}>
              <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-start">
                <label className="grid gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Query {index + 1}</span>
                  <Textarea
                    className="min-h-20 resize-y"
                    disabled={disabled}
                    maxLength={MAX_SEMANTIC_QUERY_TEXT_LENGTH}
                    onChange={(event) => updateRow(row.id, "text", event.target.value)}
                    placeholder="Looking for a better way to track leads"
                    value={row.text}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Category</span>
                  <Input
                    disabled={disabled}
                    maxLength={MAX_SEMANTIC_QUERY_CATEGORY_LENGTH}
                    onChange={(event) => updateRow(row.id, "category", event.target.value)}
                    placeholder="buyer-intent"
                    value={row.category}
                  />
                </label>
                <Button
                  aria-label={`Remove query ${index + 1}`}
                  className="min-h-11 cursor-pointer rounded-full md:mt-7"
                  disabled={disabled}
                  onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={bulkPasteOpen} onOpenChange={handleBulkPasteOpenChange}>
        <DialogContent className="max-w-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-xl">Bulk paste semantic queries</DialogTitle>
            <DialogDescription>
              Add JSON, one query per line, or plain text queries separated by triple commas. Importing again appends new unique queries to this draft.
            </DialogDescription>
          </DialogHeader>

          <label className="mt-5 grid gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#b3b3b3]">Queries</span>
            <Textarea
              className="max-h-[48dvh] min-h-[260px] resize-y font-mono text-[13px] leading-5"
              onChange={(event) => setBulkPasteValue(event.target.value)}
              placeholder={`{"semanticQueries":[{"category":"buyer-intent","text":"looking for a CRM recommendation"}]}

or
query one
query two

or
query one,,,query two`}
              value={bulkPasteValue}
            />
          </label>

          <DialogFooter className="mt-5 sm:justify-end">
            <Button className="cursor-pointer" onClick={() => handleBulkPasteOpenChange(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              className="cursor-pointer border-none bg-[#1ed760] text-[#121212] shadow-[rgba(30,215,96,0.2)_0px_8px_24px] hover:bg-[#3be477]"
              onClick={handleImportQueries}
              type="button"
            >
              <ClipboardPaste className="h-4 w-4" />
              Import queries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
