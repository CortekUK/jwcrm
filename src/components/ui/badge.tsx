import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Non-interactive status chip. Deliberately sets no colours and no
        // hover, so the caller's className is the only thing painting it.
        //
        // The `default` variant carries `hover:bg-primary/80`, and passing a
        // custom `bg-*` through className does NOT remove it: tailwind-merge
        // treats `hover:bg-*` and `bg-*` as different groups, so both survive
        // and the hover rule (higher specificity) repaints the chip dark green
        // on mouseover. Use this variant for badges that only label something.
        status: "border-transparent",
        success: "border-[hsl(var(--jw-gold-accent))] bg-[hsl(var(--jw-primary-green))] text-white hover:bg-[hsl(var(--jw-hover-green))]",
        warning: "border-[hsl(var(--jw-gold-accent))] bg-[hsl(var(--jw-gold-accent))] text-white hover:bg-[hsl(var(--jw-gold-accent))]/90",
        info: "border-[hsl(var(--jw-gold-accent))] bg-[hsl(var(--jw-muted-green))] text-white hover:bg-[hsl(var(--jw-muted-green))]/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
