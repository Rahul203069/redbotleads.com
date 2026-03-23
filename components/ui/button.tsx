import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[transform,background-color,border-color,color,box-shadow] disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "border border-white/12 bg-white text-black shadow-[0_16px_36px_rgba(255,255,255,0.12)] hover:bg-[#e4e4e7]",
        secondary:
          "border border-[#27272a] bg-[#111113] text-[#fafafa] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:border-[#3f3f46] hover:bg-[#18181b]",
        ghost: "text-[#a1a1aa] hover:bg-[#111113] hover:text-[#fafafa]",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-12 rounded-xl px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
