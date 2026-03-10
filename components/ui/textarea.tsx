import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-28 w-full rounded-md border border-[#27312E] bg-[#111716] px-3 py-3 text-sm text-[#F3F5F4] shadow-sm outline-none transition-colors placeholder:text-[#6F7C77] focus-visible:border-[#7BF179]/70 focus-visible:ring-2 focus-visible:ring-[#7BF179]/20 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
