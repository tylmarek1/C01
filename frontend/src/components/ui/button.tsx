import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Programme-style buttons: square-cut, semibold, a touch of tracking.
  // Filled variants press down 1px instead of scaling — printed paper doesn't bounce.
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-semibold tracking-[0.005em] outline-none select-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:not-disabled:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        /** Forest-ink fill — the default strong action. */
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        /** Clay accent — reserved for THE primary action of a view (book, confirm). */
        brand: "bg-brand text-brand-foreground hover:bg-brand-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-wash-strong",
        outline: "border border-foreground/25 bg-transparent text-foreground hover:border-foreground hover:bg-card",
        ghost: "text-foreground hover:bg-muted",
        subtle: "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "h-auto! px-0! text-foreground underline decoration-border-strong decoration-1 underline-offset-4 hover:decoration-brand",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        "destructive-ghost": "text-danger hover:bg-danger-soft",
        /** Back-compat alias of `default` (older call sites used `dark`). */
        dark: "bg-primary text-primary-foreground hover:bg-primary-hover",
      },
      size: {
        default: "h-9 px-4",
        xs: "h-7 gap-1.5 rounded-xs px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-xs px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-5 text-[15px]",
        xl: "h-13 px-7 text-base",
        icon: "size-9",
        "icon-xs": "size-7 rounded-xs [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 rounded-xs",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Shows a spinner in place of the leading icon and disables the button. */
  isLoading?: boolean
}

function Button({ className, variant, size, asChild = false, isLoading = false, children, disabled, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={isLoading || undefined}
      disabled={asChild ? undefined : disabled || isLoading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {isLoading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
