import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-4", className)} {...props} />
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        // max-w-full + overflow-x-auto so a tab bar wider than its container
        // scrolls internally instead of pushing the whole page wider — on a
        // narrow screen, a page with enough tabs (Profile's 7, Admin's 6)
        // otherwise grows past the viewport, and activating an off-screen
        // trigger auto-scrolls the page itself, shifting every panel with it.
        // The native scrollbar is left visible (not hidden) so it doubles as
        // the only hint that there's more to scroll to.
        "inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-pebble p-1",
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium whitespace-nowrap text-slate-gray transition-colors data-[state=active]:bg-paper data-[state=active]:text-ink-navy data-[state=active]:shadow-sm disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("outline-none", className)} {...props} />
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
