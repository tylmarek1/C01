import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-11 w-full rounded-lg border border-hairline bg-paper px-4 py-2 text-base text-ink-navy outline-none transition-colors file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink-navy placeholder:text-mist-gray focus-visible:border-signal-blue focus-visible:ring-2 focus-visible:ring-signal-blue/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive/20",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
