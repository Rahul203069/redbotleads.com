import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[transform,background-color,border-color,color,box-shadow] disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[#7BF179]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0f0e] active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "border border-[#7BF179]/30 bg-[#7BF179] text-[#08110b] shadow-[0_0_24px_rgba(123,241,121,0.18)] hover:bg-[#93f592]",
        secondary:
          "border border-[#27312E] bg-[#161D1B] text-[#F3F5F4] hover:border-[#3b4a45] hover:bg-[#1b2321]",
        ghost: "text-[#9DA9A4] hover:bg-[#161D1B] hover:text-[#F3F5F4]",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-md px-6",
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
