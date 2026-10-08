import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  tone = "default",
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { tone?: "default" | "brand" | "success" }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("relative h-1.5 w-full overflow-hidden bg-muted", className)}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 transition-transform duration-700 ease-out",
          tone === "default" && "bg-primary",
          tone === "brand" && "bg-brand",
          tone === "success" && "bg-success",
        )}
        style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value ?? 0))}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
