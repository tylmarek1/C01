import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "default" | "sm"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-transparent bg-hairline transition-colors outline-none data-[state=checked]:bg-signal-blue focus-visible:ring-2 focus-visible:ring-signal-blue/25 disabled:cursor-not-allowed disabled:opacity-50 data-[size=sm]:h-5 data-[size=sm]:w-8",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-5 translate-x-0.5 rounded-full bg-paper shadow-sm transition-transform data-[state=checked]:translate-x-[18px]",
          "group-data-[size=sm]:size-4 group-data-[size=sm]:data-[state=checked]:translate-x-[14px]",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
