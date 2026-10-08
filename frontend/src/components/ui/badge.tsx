import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Scoreboard chip: mono, uppercase, square-cut — reads as a printed label, not a pill.
  "group/badge inline-flex w-fit shrink-0 items-center gap-1.5 overflow-hidden rounded-xs border border-transparent px-1.5 py-[3px] font-mono text-[10.5px] leading-none font-medium tracking-[0.06em] uppercase whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        /** Neutral metadata chip. */
        default: "bg-muted text-foreground",
        secondary: "bg-muted text-muted-foreground",
        outline: "border-foreground/25 text-muted-foreground",
        brand: "bg-brand-soft text-brand-ink",
        solid: "bg-primary text-primary-foreground",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        destructive: "bg-danger-soft text-danger",
        info: "bg-info-soft text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  asChild?: boolean
  /** Leading status dot in the badge's own colour. */
  dot?: boolean
}

function Badge({ className, variant, asChild = false, dot = false, children, ...props }: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant, className }))} {...props}>
      {dot && <span aria-hidden className="size-1.5 shrink-0 bg-current" />}
      {children}
    </Comp>
  )
}

export { Badge, badgeVariants }
