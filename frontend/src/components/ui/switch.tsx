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
        "peer group inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-wash-strong shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)] transition-colors duration-200 outline-none data-[state=checked]:bg-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[size=sm]:h-4 data-[size=sm]:w-7",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 translate-x-0.5 rounded-full bg-card shadow-sm ring-0 transition-transform duration-200 ease-out data-[state=checked]:translate-x-[18px] dark:data-[state=checked]:bg-brand",
          "group-data-[size=sm]:size-3 group-data-[size=sm]:data-[state=checked]:translate-x-[14px]",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
